import {
  beginnInBerlin,
  ersterTag,
  istMonat,
  istTag,
  plusMonate,
  plusTage,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  type EinsatzErgebnis,
  einsaetzeIn,
  einsatzBeenden,
  einsatzBeginnen,
  einsatzEntfernen,
  einsatzNachtragen,
  fruehesterSollquellenTag,
  sollquellenVon,
  sollquelleSetzen,
} from "../modules/arbeitszeit/index.ts";
import { modulAktiv } from "../modules/betrieb/index.ts";
import { rufdiensteVon, rufdienstUm } from "../modules/plandaten/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon, zeitpunkt } from "./stempel-antwort.ts";
import { liestEigene, person } from "./zeiten.ts";

/*
 * Call-outs from a Rufbereitschaft (S-505) below /api/v1/arbeitszeit/einsaetze, and where the Soll
 * comes from below /api/v1/arbeitszeit/sollquellen. A call-out begins in a Rufbereitschaft of the
 * plan, so its routes are refused while the module Dienstplan is off; reading the month is not.
 */

const id = z.string().min(1).max(100);
const grund = z.string().trim().min(1).max(500);
export const nachtragSchema = z
  .object({ nutzerId: id.optional(), beginn: zeitpunkt, ende: zeitpunkt, grund })
  .strict()
  .refine(({ beginn, ende }) => ende > beginn && beginn % 60_000 === 0 && ende % 60_000 === 0);
export const entfernenSchema = z.object({ grund }).strict();
export const frageSchema = z
  .object({ nutzerId: id.optional(), monat: z.string().refine(istMonat).optional() })
  .strict();
export const quelleSchema = z
  .object({ ab: z.string().refine(istTag), quelle: z.enum(["modell", "plan"]) })
  .strict();

const STATUS = {
  keine_rufbereitschaft: 409,
  laeuft_schon: 409,
  laeuft_nicht: 409,
  ueberschneidung: 409,
  zukunft: 422,
  zu_lang: 422,
  monat_gesperrt: 409,
  unbekannt: 404,
} as const;

const antwort = (c: Context<Anfrage>, ergebnis: EinsatzErgebnis, status: 200 | 201) =>
  ergebnis.ok
    ? c.json(ergebnis.einsatz, status)
    : c.json({ fehler: ergebnis.grund }, STATUS[ergebnis.grund]);

/** The routes that write need the plan: a call-out begins in one of its duties */
const mitPlan = (db: Db) => async (c: Context<Anfrage>, next: () => Promise<void>) => {
  if (!modulAktiv(db, c.get("betriebId"), "dienstplan"))
    return c.json({ fehler: "dienstplan_aus" }, 403);
  await next();
};

/**
 * A person's call-outs of a month (by their start) and, for the clock, the published duty that
 * holds now and the call-out running; one's own, or anyone's for whoever sees all times
 */
const lesen = (db: Db, jetzt: () => number) => (c: Context<Anfrage>) => {
  const frage = frageSchema.safeParse(c.req.query());
  if (!frage.success) return c.json({ fehler: "ungueltig" }, 400);
  const wer = person(db, c, frage.data.nutzerId, "zeiten:alle");
  if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
  if (wer.nutzerId === c.get("nutzerId") && !liestEigene(db, c))
    return c.json({ fehler: "keine_berechtigung" }, 403);
  const betriebId = c.get("betriebId");
  const monat = frage.data.monat ?? tagInBerlin(jetzt()).slice(0, 7);
  const von = beginnInBerlin(ersterTag(monat));
  const bis = beginnInBerlin(ersterTag(plusMonate(monat, 1)));
  const einsaetze = einsaetzeIn(db, betriebId, wer.nutzerId, von, bis);
  const heute = tagInBerlin(jetzt());
  return c.json({
    einsaetze,
    // a call-out lasts under 24 hours (R-01), so a running one began within the last day
    laufend:
      einsaetzeIn(db, betriebId, wer.nutzerId, jetzt() - 86_400_000, jetzt() + 1).find(
        (e) => e.ende === null,
      ) ?? null,
    jetzt: rufdienstUm(db, betriebId, wer.nutzerId, jetzt()) ?? null,
    // the published duties from yesterday to tomorrow, for the clock screen
    naechste: rufdiensteVon(db, betriebId, wer.nutzerId, plusTage(heute, -1), plusTage(heute, 1)),
  });
};

export const einsatzRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", lesen(db, jetzt))
    .use(mitPlan(db))
    .use(recht("stempeln"))
    .post("/beginnen", (c) =>
      antwort(c, einsatzBeginnen(db, schreibDb, kontextVon(c, jetzt), c.get("nutzerId")), 201),
    )
    .post("/beenden", (c) =>
      antwort(c, einsatzBeenden(db, schreibDb, kontextVon(c, jetzt), c.get("nutzerId")), 200),
    )
    .post("/", async (c) => {
      const eingabe = await koerper(c, nachtragSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const wer = person(db, c, eingabe.data.nutzerId, "zeiten:korrigieren");
      if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
      const angaben = { ...eingabe.data, nutzerId: wer.nutzerId };
      return antwort(c, einsatzNachtragen(db, schreibDb, kontextVon(c, jetzt), angaben), 201);
    })
    .post("/:einsatzId/entfernen", async (c) => {
      const eingabe = await koerper(c, entfernenSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return antwort(
        c,
        einsatzEntfernen(db, schreibDb, kontextVon(c, jetzt), {
          einsatzId: c.req.param("einsatzId"),
          grund: eingabe.data.grund,
          fuerAndere: darf(c.get("rolle"), "zeiten:korrigieren"),
        }),
        200,
      );
    });

/**
 * Where the Soll comes from (S-505): every member who reads the business sees it, as the month says
 * it; only the owner sets it (`betrieb:einrichten`)
 */
export const sollquellenRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", recht("betrieb:lesen"), (c) =>
      c.json({
        quellen: sollquellenVon(db, c.get("betriebId")),
        fruehestens: fruehesterSollquellenTag(db, c.get("betriebId")),
      }),
    )
    .put("/", recht("betrieb:einrichten"), async (c) => {
      const eingabe = await koerper(c, quelleSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const ergebnis = sollquelleSetzen(db, schreibDb, kontextVon(c, jetzt), eingabe.data);
      if (ergebnis.ok) return c.json({ quellen: ergebnis.quellen });
      return ergebnis.grund === "modul_aus"
        ? c.json({ fehler: "dienstplan_aus" }, 403)
        : c.json({ fehler: ergebnis.grund }, 409);
    });

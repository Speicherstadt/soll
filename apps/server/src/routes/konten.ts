import { istMonat, istTag, type Tag, tagInBerlin } from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  anpassungAnlegen,
  anpassungenVon,
  hinweiseVon,
  hinweisGeben,
  type KontoFehler,
  type UrlaubskontoStand,
  ueberstundenVon,
  urlaubskontoVon,
} from "../modules/arbeitszeit/index.ts";
import { namenVon } from "../modules/mitglieder/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";
import { liestEigene, person } from "./zeiten.ts";

const id = z.string().min(1).max(100);
const grund = z.string().trim().min(1).max(500);
const monat = z.string().refine(istMonat);
const jahr = z.number().int().min(2000).max(9998);
/** whole minutes and half days, both far beyond any real account */
const minuten = z.number().int().min(-1_000_000).max(1_000_000);
const halbtage = z.number().int().min(-1000).max(1000);

export const kontoSchema = z.object({ nutzerId: id.optional() }).strict();
export const hinweisSchema = z.object({ tag: z.string().refine(istTag) }).strict();
export const anpassungSchema = z.discriminatedUnion("art", [
  z.object({ art: z.literal("startsaldo"), monat, minuten, grund }).strict(),
  z
    .object({ art: z.literal("korrektur"), monat, minuten: minuten.refine((m) => m !== 0), grund })
    .strict(),
  z.object({ art: z.literal("auszahlung"), monat, minuten: minuten.positive(), grund }).strict(),
  z.object({ art: z.literal("urlaub_start"), jahr, halbtage: halbtage.min(0), grund }).strict(),
  z
    .object({
      art: z.literal("urlaub_korrektur"),
      jahr,
      halbtage: halbtage.refine((h) => h !== 0),
      grund,
    })
    .strict(),
]);

const STATUS: Record<KontoFehler, 409 | 422> = {
  vorhanden: 409,
  widerspruch: 409,
  nicht_hinterlegt: 409,
  ungueltig: 422,
};

/**
 * The leave account as a reader may see it: whoever does not see sickness gets of another person
 * only what is left and planned, as the years with leave taken would tell sickness in leave (§ 9
 * BUrlG, Art. 9 DSGVO; docs/plan.md, "Wer krank sieht")
 */
const urlaubSicht = (stand: UrlaubskontoStand, voll: boolean) => {
  if (!stand.ok) return stand;
  const kurz = {
    ok: true as const,
    restHalbtage: stand.konto.restHalbtage,
    geplantHalbtage: stand.geplantHalbtage,
  };
  return voll
    ? {
        ...kurz,
        startJahr: stand.startJahr,
        toepfe: stand.konto.toepfe,
        befunde: stand.konto.befunde,
      }
    : kurz;
};

/** The accounts of one person; there is no list of everyone's (BetrVG § 87 Abs. 1 Nr. 6) */
const konten = (db: Db, c: Context<Anfrage>, nutzerId: string, heute: Tag) => {
  const betriebId = c.get("betriebId");
  // one's own, or with the right to see sickness (owner, payroll): everything; a planner reads
  // what is left, without changes by hand (payouts are payroll's) or notices
  const voll = nutzerId === c.get("nutzerId") || darf(c.get("rolle"), "abwesenheiten:gesundheit");
  const ueberstunden = ueberstundenVon(db, betriebId, nutzerId);
  return {
    nutzerId,
    name: namenVon(db, [nutzerId]).get(nutzerId) ?? "",
    heute,
    rechte: { pflegen: darf(c.get("rolle"), "konten:pflegen") },
    urlaub: urlaubSicht(urlaubskontoVon(db, betriebId, nutzerId, heute), voll),
    ueberstunden: ueberstunden.ok ? { ok: true, ...ueberstunden.konto } : ueberstunden,
    hinweise: voll
      ? hinweiseVon(db, betriebId, nutzerId).map(({ hinweisId, tag, inhalt, erstelltAm }) => ({
          hinweisId,
          tag,
          inhalt,
          erstelltAm,
        }))
      : [],
    anpassungen: voll
      ? anpassungenVon(db, betriebId, nutzerId).map(
          ({ betriebId: _b, nutzerId: _n, erstelltVon: _v, ...a }) => a,
        )
      : [],
  };
};

/** The person a change is for: whoever the owner may read the times of, else unknown (404) */
const ziel = (db: Db, c: Context<Anfrage>) => person(db, c, c.req.param("nutzerId"), "zeiten:alle");

/**
 * The accounts below /api/v1/arbeitszeit/konten (S-402): leave and overtime of a person, computed;
 * the owner changes them by hand and records the notice on leave expiring
 */
export const kontenRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", (c) => {
      const eingabe = kontoSchema.safeParse(c.req.query());
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const wer = person(db, c, eingabe.data.nutzerId, "zeiten:alle");
      if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
      if (wer.nutzerId === c.get("nutzerId") && !liestEigene(db, c))
        return c.json({ fehler: "keine_berechtigung" }, 403);
      return c.json(konten(db, c, wer.nutzerId, tagInBerlin(jetzt())));
    })
    .post("/:nutzerId/anpassungen", recht("konten:pflegen"), async (c) => {
      const eingabe = await koerper(c, anpassungSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const wer = ziel(db, c);
      if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
      const ergebnis = anpassungAnlegen(
        db,
        schreibDb,
        kontextVon(c, jetzt),
        wer.nutzerId,
        eingabe.data,
      );
      if (!ergebnis.ok) return c.json({ fehler: ergebnis.fehler }, STATUS[ergebnis.fehler]);
      return c.json({ anpassungId: ergebnis.wert.anpassungId }, 201);
    })
    .post("/:nutzerId/hinweise", recht("konten:pflegen"), async (c) => {
      const eingabe = await koerper(c, hinweisSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const wer = ziel(db, c);
      if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
      const kontext = kontextVon(c, jetzt);
      const ergebnis = hinweisGeben(
        db,
        schreibDb,
        kontext,
        wer.nutzerId,
        eingabe.data.tag,
        tagInBerlin(kontext.jetzt),
      );
      if (!ergebnis.ok) return c.json({ fehler: ergebnis.fehler }, STATUS[ergebnis.fehler]);
      const { hinweisId, tag, inhalt, erstelltAm } = ergebnis.wert;
      return c.json({ hinweisId, tag, inhalt, erstelltAm }, 201);
    });

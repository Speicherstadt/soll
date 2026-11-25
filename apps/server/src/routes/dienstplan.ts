import { istTag, tagInBerlin } from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  bedarfAnlegen,
  bedarfEntfernen,
  bedarfeLesen,
  planerWoche,
  planMelden,
  type SchichtErgebnis,
  schichtAendern,
  schichtAnlegen,
  schichtEntfernen,
  standortVorhanden,
  veroeffentlichteWoche,
  verweisFehler,
  vorlageAendern,
  vorlageAnlegen,
  vorlageEntfernen,
  vorlagenLesen,
  wocheVeroeffentlichen,
} from "../modules/dienstplan/index.ts";
import type { ZustellDeps } from "../modules/erinnerungen/index.ts";
import { kalenderRouten } from "./dienstplan-kalender.ts";
import { rufdienstRouten } from "./dienstplan-rufdienste.ts";
import { tauschRouten } from "./dienstplan-tausch.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";

/** A time on the Berlin clock in whole minutes after midnight (CLAUDE.md, "Never": no floats) */
const minute = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 - 1);
const id = z.string().min(1).max(100);
const rolle = z.string().trim().max(60);
/** An end at or before the beginning lies on the next day; the same time is no span at all */
const spanne = ({ beginnMinute, endeMinute }: { beginnMinute?: number; endeMinute?: number }) =>
  beginnMinute === undefined || beginnMinute !== endeMinute;

/**
 * A template's break must be shorter than its shift on the clock, an end at or before the beginning
 * on the next day, as for a shift (`pause_zu_lang`): else no shift could be planned from it
 */
const pauseKuerzer = (vorlage: {
  beginnMinute: number;
  endeMinute: number;
  pauseMinuten: number;
}) => {
  const laenge = (vorlage.endeMinute - vorlage.beginnMinute + 24 * 60) % (24 * 60);
  return vorlage.pauseMinuten < laenge;
};

export const vorlageSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    beginnMinute: minute,
    endeMinute: minute,
    pauseMinuten: minute.default(0),
    rolle: rolle.default(""),
    standortId: id.nullable().default(null),
  })
  .strict()
  .refine(spanne)
  .refine(pauseKuerzer);

export const bedarfSchema = z
  .object({
    standortId: id,
    rolle: rolle.min(1),
    wochentag: z.number().int().min(1).max(7),
    beginnMinute: minute,
    endeMinute: minute,
    anzahl: z.number().int().min(1).max(99),
  })
  .strict()
  .refine(spanne);

const schichtFelder = {
  standortId: id,
  tag: z.string().refine(istTag),
  beginnMinute: minute,
  endeMinute: minute,
  pauseMinuten: minute,
  rolle,
  nutzerId: id.nullable(),
};
export const schichtSchema = z
  .object({
    ...schichtFelder,
    pauseMinuten: minute.default(0),
    rolle: rolle.default(""),
    vorlageId: id.nullable().default(null),
  })
  .strict()
  .refine(spanne);
export const aenderungSchema = z.object(schichtFelder).partial().strict();
export const wocheSchema = z
  .object({ standortId: id, tag: z.string().refine(istTag).optional() })
  .strict();
export const veroeffentlichenSchema = z
  .object({ standortId: id, tag: z.string().refine(istTag) })
  .strict();
export const standortFrage = z.object({ standortId: id }).strict();

const STATUS = {
  unbekannt: 404,
  standort_unbekannt: 404,
  person_unbekannt: 404,
  vorlage_unbekannt: 404,
  zeit_gibt_es_nicht: 422,
  pause_zu_lang: 400,
} as const;

const schichtAntwort = (c: Context<Anfrage>, ergebnis: SchichtErgebnis, status: 200 | 201) =>
  ergebnis.ok
    ? c.json(ergebnis.schicht, status)
    : c.json({ fehler: ergebnis.grund }, STATUS[ergebnis.grund]);

/** Shift templates: whoever plans reads and changes them */
const vorlagenRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("plan:planen"))
    .get("/", (c) => c.json({ vorlagen: vorlagenLesen(db, c.get("betriebId")) }))
    .post("/", async (c) => {
      const eingabe = await koerper(c, vorlageSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const fehler = verweisFehler(db, c.get("betriebId"), eingabe.data);
      if (fehler) return c.json({ fehler }, 404);
      return c.json(vorlageAnlegen(schreibDb, kontextVon(c, jetzt), eingabe.data), 201);
    })
    .put("/:vorlageId", async (c) => {
      const eingabe = await koerper(c, vorlageSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const fehler = verweisFehler(db, c.get("betriebId"), eingabe.data);
      if (fehler) return c.json({ fehler }, 404);
      const kontext = kontextVon(c, jetzt);
      const vorlage = vorlageAendern(
        db,
        schreibDb,
        kontext,
        c.req.param("vorlageId"),
        eingabe.data,
      );
      return vorlage ? c.json(vorlage) : c.json({ fehler: "unbekannt" }, 404);
    })
    .delete("/:vorlageId", (c) =>
      vorlageEntfernen(db, schreibDb, kontextVon(c, jetzt), c.req.param("vorlageId"))
        ? c.body(null, 204)
        : c.json({ fehler: "unbekannt" }, 404),
    );

/** The need per role of a site: whoever plans reads and changes it */
const bedarfRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("plan:planen"))
    .get("/", (c) => {
      const frage = standortFrage.safeParse(c.req.query());
      if (!frage.success) return c.json({ fehler: "ungueltig" }, 400);
      if (!standortVorhanden(db, c.get("betriebId"), frage.data.standortId))
        return c.json({ fehler: "standort_unbekannt" }, 404);
      return c.json({ bedarfe: bedarfeLesen(db, c.get("betriebId"), frage.data.standortId) });
    })
    .post("/", async (c) => {
      const eingabe = await koerper(c, bedarfSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      if (!standortVorhanden(db, c.get("betriebId"), eingabe.data.standortId))
        return c.json({ fehler: "standort_unbekannt" }, 404);
      return c.json(bedarfAnlegen(schreibDb, kontextVon(c, jetzt), eingabe.data), 201);
    })
    .delete("/:bedarfId", (c) =>
      bedarfEntfernen(db, schreibDb, kontextVon(c, jetzt), c.req.param("bedarfId"))
        ? c.body(null, 204)
        : c.json({ fehler: "unbekannt" }, 404),
    );

/**
 * Planned shifts: whoever plans adds, moves, changes and removes them; a new shift is a draft, a
 * change to a published one is told to the people it concerns (S-503)
 */
const schichtRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  zustellung: ZustellDeps | null,
) =>
  new Hono<Anfrage>()
    .use(recht("plan:planen"))
    .post("/", async (c) => {
      const eingabe = await koerper(c, schichtSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return schichtAntwort(
        c,
        schichtAnlegen(db, schreibDb, kontextVon(c, jetzt), eingabe.data),
        201,
      );
    })
    .patch("/:schichtId", async (c) => {
      const eingabe = await koerper(c, aenderungSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = kontextVon(c, jetzt);
      const ergebnis = schichtAendern(
        db,
        schreibDb,
        kontext,
        c.req.param("schichtId"),
        eingabe.data,
      );
      if (ergebnis.ok) await planMelden(zustellung, kontext, ergebnis.meldungen);
      return schichtAntwort(c, ergebnis, 200);
    })
    .delete("/:schichtId", async (c) => {
      const kontext = kontextVon(c, jetzt);
      const meldungen = schichtEntfernen(db, schreibDb, kontext, c.req.param("schichtId"));
      if (meldungen === null) return c.json({ fehler: "unbekannt" }, 404);
      await planMelden(zustellung, kontext, meldungen);
      return c.body(null, 204);
    });

/** What the plan needs besides the database: the way to tell people, the instance's address */
export type PlanDeps = { zustellung: ZustellDeps | null; url: string };

/**
 * The plan, below /api/v1/dienstplan (S-501): refused while the module is off. Owner and planner
 * plan the draft and publish a week; everyone else who works for the business reads only what is
 * published, subscribes to their own shifts as a calendar (S-503) and swaps them (S-504).
 */
export const dienstplanRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  deps: PlanDeps,
) =>
  new Hono<Anfrage>()
    .get("/woche", recht("plan:lesen"), (c) => {
      const frage = wocheSchema.safeParse(c.req.query());
      if (!frage.success) return c.json({ fehler: "ungueltig" }, 400);
      const betriebId = c.get("betriebId");
      const { standortId, tag = tagInBerlin(jetzt()) } = frage.data;
      if (!standortVorhanden(db, betriebId, standortId))
        return c.json({ fehler: "standort_unbekannt" }, 404);
      return c.json(
        darf(c.get("rolle"), "plan:planen")
          ? planerWoche(db, betriebId, standortId, tag, jetzt())
          : veroeffentlichteWoche(db, betriebId, standortId, tag),
      );
    })
    .post("/veroeffentlichen", recht("plan:planen"), async (c) => {
      const eingabe = await koerper(c, veroeffentlichenSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      if (!standortVorhanden(db, c.get("betriebId"), eingabe.data.standortId))
        return c.json({ fehler: "standort_unbekannt" }, 404);
      const kontext = kontextVon(c, jetzt);
      const { anzahl, meldungen } = wocheVeroeffentlichen(
        db,
        schreibDb,
        kontext,
        eingabe.data.standortId,
        eingabe.data.tag,
      );
      const gemeldet = await planMelden(deps.zustellung, kontext, meldungen);
      return c.json({
        anzahl,
        benachrichtigt: gemeldet.filter((g) => g.kanal !== "keiner").length,
      });
    })
    .route("/vorlagen", vorlagenRouten(db, schreibDb, jetzt))
    .route("/bedarf", bedarfRouten(db, schreibDb, jetzt))
    .route("/schichten", schichtRouten(db, schreibDb, jetzt, deps.zustellung))
    .route("/rufdienste", rufdienstRouten(db, schreibDb, jetzt, deps.zustellung))
    .route("/kalender", kalenderRouten(db, schreibDb, jetzt, deps.url))
    .route("/tausch", tauschRouten(db, schreibDb, jetzt, deps.zustellung));

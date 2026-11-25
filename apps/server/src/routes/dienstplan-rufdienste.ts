import { istTag } from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  planMelden,
  type RufdienstErgebnis,
  rufdienstAendern,
  rufdienstAnlegen,
  rufdienstEntfernen,
} from "../modules/dienstplan/index.ts";
import type { ZustellDeps } from "../modules/erinnerungen/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";

/*
 * Rufbereitschaft in the plan (S-505), below /api/v1/dienstplan/rufdienste: whoever plans adds,
 * changes and removes it; a new one is a draft, a change to a published one is told (S-503)
 */

const minute = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 - 1);
const id = z.string().min(1).max(100);
/** The reaction time in whole minutes, at most a day; null: none agreed (counts fully, R-12) */
const reaktion = z
  .number()
  .int()
  .min(0)
  .max(24 * 60)
  .nullable();

const felder = {
  standortId: id,
  nutzerId: id,
  tag: z.string().refine(istTag),
  beginnMinute: minute,
  endeMinute: minute,
  reaktionMinuten: reaktion,
};
const spanne = ({ beginnMinute, endeMinute }: { beginnMinute?: number; endeMinute?: number }) =>
  beginnMinute === undefined || beginnMinute !== endeMinute;

export const rufdienstSchema = z
  .object({ ...felder, reaktionMinuten: reaktion.default(null) })
  .strict()
  .refine(spanne);
export const rufAenderungSchema = z.object(felder).partial().strict();

const STATUS = {
  unbekannt: 404,
  standort_unbekannt: 404,
  person_unbekannt: 404,
  vorlage_unbekannt: 404,
  zeit_gibt_es_nicht: 422,
} as const;

const antwort = (c: Context<Anfrage>, ergebnis: RufdienstErgebnis, status: 200 | 201) =>
  ergebnis.ok
    ? c.json(ergebnis.rufdienst, status)
    : c.json({ fehler: ergebnis.grund }, STATUS[ergebnis.grund]);

export const rufdienstRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  zustellung: ZustellDeps | null,
) =>
  new Hono<Anfrage>()
    .use(recht("plan:planen"))
    .post("/", async (c) => {
      const eingabe = await koerper(c, rufdienstSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return antwort(c, rufdienstAnlegen(db, schreibDb, kontextVon(c, jetzt), eingabe.data), 201);
    })
    .patch("/:rufdienstId", async (c) => {
      const eingabe = await koerper(c, rufAenderungSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = kontextVon(c, jetzt);
      const ergebnis = rufdienstAendern(
        db,
        schreibDb,
        kontext,
        c.req.param("rufdienstId"),
        eingabe.data,
      );
      if (ergebnis.ok) await planMelden(zustellung, kontext, ergebnis.meldungen);
      return antwort(c, ergebnis, 200);
    })
    .delete("/:rufdienstId", async (c) => {
      const kontext = kontextVon(c, jetzt);
      const meldungen = rufdienstEntfernen(db, schreibDb, kontext, c.req.param("rufdienstId"));
      if (meldungen === null) return c.json({ fehler: "unbekannt" }, 404);
      await planMelden(zustellung, kontext, meldungen);
      return c.body(null, 204);
    });

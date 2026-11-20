import { Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  buchungAendern,
  buchungAnlegen,
  buchungEntfernen,
  buchungenAbrechnen,
} from "../modules/projektzeit/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { antwort, koerper, kontextVon, nichtLeer, ungueltig } from "./projektzeit-gemeinsam.ts";
import { bezug, buchendePerson, notiz } from "./stoppuhr.ts";

/** An instant on a whole minute, in UTC milliseconds (CLAUDE.md, "Time") */
const minute = z
  .number()
  .int()
  .min(0)
  .refine((ms) => ms % 60_000 === 0);

const neuSchema = z
  .object({
    nutzerId: z.string().min(1).optional(),
    ...bezug,
    beginn: minute,
    ende: minute,
    notiz: notiz.optional(),
  })
  .strict();

const aenderungSchema = z
  .object({ ...bezug, beginn: minute, ende: minute, notiz })
  .partial()
  .strict()
  .refine(nichtLeer);

const abrechnenSchema = z
  .object({ buchungIds: z.array(z.string().min(1)).min(1).max(1_000) })
  .strict();

/**
 * Bookings of project time below /api/v1/projektzeit/buchungen (S-602): one's own, and everyone's
 * for owner and planner, who also mark them billed
 */
export const buchungRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("projekte:lesen"))
    .post("/abrechnen", recht("projekte:verwalten"), async (c) => {
      const eingabe = abrechnenSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const ergebnis = buchungenAbrechnen(
        db,
        schreibDb,
        kontextVon(c, jetzt),
        eingabe.data.buchungIds,
      );
      return ergebnis.ok ? c.json({ buchungen: ergebnis.wert }) : antwort(c, ergebnis);
    })
    .post("/", async (c) => {
      const eingabe = neuSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const { nutzerId, ...neu } = eingabe.data;
      const wer = buchendePerson(db, c, nutzerId);
      if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
      const kontext = kontextVon(c, jetzt);
      return antwort(
        c,
        buchungAnlegen(db, schreibDb, kontext, { ...neu, nutzerId: wer.nutzerId }),
        201,
      );
    })
    .patch("/:buchungId", async (c) => {
      const eingabe = aenderungSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const fuerAndere = darf(c.get("rolle"), "projekte:verwalten");
      const id = c.req.param("buchungId");
      return antwort(
        c,
        buchungAendern(db, schreibDb, kontextVon(c, jetzt), id, eingabe.data, fuerAndere),
      );
    })
    .delete("/:buchungId", (c) => {
      const fuerAndere = darf(c.get("rolle"), "projekte:verwalten");
      const id = c.req.param("buchungId");
      return antwort(c, buchungEntfernen(db, schreibDb, kontextVon(c, jetzt), id, fuerAndere));
    });

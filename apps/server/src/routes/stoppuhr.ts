import { istTag } from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  bucht,
  stoppuhrStarten,
  stoppuhrStoppen,
  stoppuhrTag,
} from "../modules/projektzeit/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { antwort, koerper, kontextVon, ungueltig } from "./projektzeit-gemeinsam.ts";

export const notiz = z.string().trim().max(500);
export const bezug = {
  projektId: z.string().min(1).nullable(),
  taetigkeitId: z.string().min(1),
};

const startSchema = z
  .object({ ...bezug, notiz: notiz.optional() })
  .partial({ projektId: true })
  .strict();

const tagSchema = z
  .object({ tag: z.string().refine(istTag).optional(), nutzerId: z.string().min(1).optional() })
  .strict();

/**
 * The person whose project time a request is about: the caller, or (for owner and planner) a
 * member of the business who books project time
 */
export const buchendePerson = (
  db: Db,
  c: Context<Anfrage>,
  nutzerId: string | undefined,
): { ok: true; nutzerId: string } | { ok: false; fehler: string; status: 403 | 422 } => {
  const ziel = nutzerId ?? c.get("nutzerId");
  if (ziel === c.get("nutzerId")) return { ok: true, nutzerId: ziel };
  if (!darf(c.get("rolle"), "projekte:verwalten"))
    return { ok: false, fehler: "keine_berechtigung", status: 403 };
  return bucht(db, c.get("betriebId"), ziel)
    ? { ok: true, nutzerId: ziel }
    : { ok: false, fehler: "person_unbekannt", status: 422 };
};

/** The stopwatch below /api/v1/projektzeit/stoppuhr (S-602): for whoever books project time */
export const stoppuhrRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("projekte:lesen"))
    .get("/", (c) => {
      const eingabe = tagSchema.safeParse(c.req.query());
      if (!eingabe.success) return ungueltig(c);
      const wer = buchendePerson(db, c, eingabe.data.nutzerId);
      // a person of another business is no one here
      if (!wer.ok)
        return wer.status === 422
          ? c.json({ fehler: "unbekannt" }, 404)
          : c.json({ fehler: wer.fehler }, wer.status);
      return c.json(stoppuhrTag(db, c.get("betriebId"), wer.nutzerId, eingabe.data.tag, jetzt()));
    })
    .post("/start", async (c) => {
      const eingabe = startSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const { projektId = null, ...rest } = eingabe.data;
      const kontext = kontextVon(c, jetzt);
      const ergebnis = stoppuhrStarten(db, schreibDb, kontext, kontext.akteur, {
        ...rest,
        projektId,
      });
      if (!ergebnis.ok) return antwort(c, ergebnis);
      const { laufend, beendet, neu } = ergebnis.wert;
      return c.json({ laufend, beendet }, neu ? 201 : 200);
    })
    .post("/stopp", (c) => {
      const kontext = kontextVon(c, jetzt);
      return antwort(c, stoppuhrStoppen(db, schreibDb, kontext, kontext.akteur));
    });

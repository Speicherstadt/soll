import { istTag } from "@soll/arbeitszeit";
import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { mitgliedschaftVon } from "../modules/mitglieder/index.ts";
import { angabenLesen, angabenSetzen } from "../modules/personen/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";

const tag = z.string().refine(istTag);

/** A span of the Mutterschutz: from a day to a day, or on while `bis` is null */
const spanne = z
  .object({ von: tag, bis: tag.nullable() })
  .strict()
  .refine(({ von, bis }) => bis === null || von <= bis);

const angabenSchema = z
  .object({
    geburtsdatum: tag.nullable(),
    wechselschicht: z.boolean(),
    abruf: z.boolean(),
    mutterschutz: z.array(spanne).max(20),
  })
  .strict();

/**
 * What the rules need of a person (S-502), below /api/v1/personen: only the owner reads and writes
 * it; a person of another business is unknown (404), never read or written
 */
export const personenRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("personen:angaben"))
    .get("/:nutzerId/angaben", (c) => {
      const nutzerId = c.req.param("nutzerId");
      if (!mitgliedschaftVon(db, c.get("betriebId"), nutzerId))
        return c.json({ fehler: "unbekannt" }, 404);
      return c.json(angabenLesen(db, c.get("betriebId"), nutzerId));
    })
    .put("/:nutzerId/angaben", async (c) => {
      const eingabe = await koerper(c, angabenSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const nutzerId = c.req.param("nutzerId");
      if (!mitgliedschaftVon(db, c.get("betriebId"), nutzerId))
        return c.json({ fehler: "unbekannt" }, 404);
      return c.json(angabenSetzen(db, schreibDb, kontextVon(c, jetzt), nutzerId, eingabe.data));
    });

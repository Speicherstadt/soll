import { istTag } from "@soll/arbeitszeit";
import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  fruehesterSollquellenTag,
  sollquellenVon,
  sollquelleSetzen,
} from "../modules/arbeitszeit/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";

export const sollquelleSchema = z
  .object({
    ab: z.string().refine(istTag),
    quelle: z.enum(["modell", "plan"]),
  })
  .strict();

/**
 * Soll aus dem Plan (S-505), below /api/v1/arbeitszeit/sollquellen: everyone in the business may
 * read which source holds from when; only the owner sets it, never into a closed month, and the
 * plan only while the module Dienstplan is active.
 */
export const sollquellenRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", recht("betrieb:lesen"), (c) => {
      const betriebId = c.get("betriebId");
      return c.json({
        quellen: sollquellenVon(db, betriebId),
        fruehestens: fruehesterSollquellenTag(db, betriebId),
      });
    })
    .put("/", recht("betrieb:einrichten"), async (c) => {
      const eingabe = await koerper(c, sollquelleSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const ergebnis = sollquelleSetzen(db, schreibDb, kontextVon(c, jetzt), eingabe.data);
      if (!ergebnis.ok) return c.json({ fehler: ergebnis.grund }, 409);
      return c.json({ quellen: ergebnis.quellen, fruehestens: ergebnis.fruehestens });
    });

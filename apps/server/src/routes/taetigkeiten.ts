import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  taetigkeitAendern,
  taetigkeitAnlegen,
  taetigkeitEntfernen,
  taetigkeitenLesen,
} from "../modules/projektzeit/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import {
  antwort,
  archiviert,
  beideOderKeins,
  extern,
  koerper,
  kontextVon,
  name,
  nichtLeer,
  ungueltig,
} from "./projektzeit-gemeinsam.ts";

export const neuSchema = z
  .object({ name, abrechenbar: z.boolean().optional(), ...extern })
  .strict()
  .refine(beideOderKeins);

export const aenderungSchema = z
  .object({ name, abrechenbar: z.boolean(), archiviert })
  .partial()
  .strict()
  .refine(nichtLeer);

/** The activities of the caller's business with the four fixed ones, below /api/v1/projektzeit */
export const taetigkeitRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", recht("projekte:lesen"), (c) =>
      c.json({ taetigkeiten: taetigkeitenLesen(db, c.get("betriebId")) }),
    )
    .post("/", recht("projekte:verwalten"), async (c) => {
      const eingabe = neuSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      return antwort(c, taetigkeitAnlegen(schreibDb, kontextVon(c, jetzt), eingabe.data), 201);
    })
    .patch("/:taetigkeitId", recht("projekte:verwalten"), async (c) => {
      const eingabe = aenderungSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const id = c.req.param("taetigkeitId");
      return antwort(c, taetigkeitAendern(db, schreibDb, kontextVon(c, jetzt), id, eingabe.data));
    })
    .delete("/:taetigkeitId", recht("projekte:verwalten"), (c) => {
      const id = c.req.param("taetigkeitId");
      return antwort(c, taetigkeitEntfernen(db, schreibDb, kontextVon(c, jetzt), id));
    });

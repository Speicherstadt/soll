import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  kundeAendern,
  kundeAnlegen,
  kundeEntfernen,
  kundenLesen,
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
  nummer,
  ungueltig,
} from "./projektzeit-gemeinsam.ts";

export const neuSchema = z
  .object({ name, nummer: nummer.optional(), ...extern })
  .strict()
  .refine(beideOderKeins);

export const aenderungSchema = z
  .object({ name, nummer, archiviert })
  .partial()
  .strict()
  .refine(nichtLeer);

/** The customers of the caller's business, below /api/v1/projektzeit (S-601) */
export const kundenRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", recht("projekte:lesen"), (c) =>
      c.json({ kunden: kundenLesen(db, c.get("betriebId")) }),
    )
    .post("/", recht("projekte:verwalten"), async (c) => {
      const eingabe = neuSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      return antwort(c, kundeAnlegen(schreibDb, kontextVon(c, jetzt), eingabe.data), 201);
    })
    .patch("/:kundeId", recht("projekte:verwalten"), async (c) => {
      const eingabe = aenderungSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const kontext = kontextVon(c, jetzt);
      return antwort(c, kundeAendern(db, schreibDb, kontext, c.req.param("kundeId"), eingabe.data));
    })
    .delete("/:kundeId", recht("projekte:verwalten"), (c) =>
      antwort(c, kundeEntfernen(db, schreibDb, kontextVon(c, jetzt), c.req.param("kundeId"))),
    );

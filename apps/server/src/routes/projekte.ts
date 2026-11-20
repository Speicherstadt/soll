import { Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  type Projekt,
  projektAendern,
  projektAnlegen,
  projektEntfernen,
  projekteLesen,
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

/** Whole minutes and whole cents above zero, or null for no budget (CLAUDE.md, "Never") */
const budget = {
  budgetMinuten: z.number().int().min(1).max(10_000_000).nullable(),
  budgetCent: z.number().int().min(1).max(100_000_000_000).nullable(),
  warnungProzent: z.number().int().min(1).max(100),
};

export const neuSchema = z
  .object({ kundeId: z.string().min(1), name, nummer, ...budget })
  .partial({ nummer: true, budgetMinuten: true, budgetCent: true, warnungProzent: true })
  .extend(extern)
  .strict()
  .refine(beideOderKeins);

export const aenderungSchema = z
  .object({ name, nummer, ...budget, archiviert })
  .partial()
  .strict()
  .refine(nichtLeer);

/** Money is for whoever keeps the orders; the others see the order and its budget in minutes */
const ohneGeld = ({ budgetCent: _cent, ...projekt }: Projekt) => projekt;

/** The orders of the caller's business, below /api/v1/projektzeit (S-601) */
export const projektRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", recht("projekte:lesen"), (c) => {
      const projekte = projekteLesen(db, c.get("betriebId"));
      const geld = darf(c.get("rolle"), "projekte:verwalten");
      return c.json({ projekte: geld ? projekte : projekte.map(ohneGeld) });
    })
    .post("/", recht("projekte:verwalten"), async (c) => {
      const eingabe = neuSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      return antwort(c, projektAnlegen(db, schreibDb, kontextVon(c, jetzt), eingabe.data), 201);
    })
    .patch("/:projektId", recht("projekte:verwalten"), async (c) => {
      const eingabe = aenderungSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const id = c.req.param("projektId");
      return antwort(c, projektAendern(db, schreibDb, kontextVon(c, jetzt), id, eingabe.data));
    })
    .delete("/:projektId", recht("projekte:verwalten"), (c) =>
      antwort(c, projektEntfernen(db, schreibDb, kontextVon(c, jetzt), c.req.param("projektId"))),
    );

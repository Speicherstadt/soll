import { istTag } from "@soll/arbeitszeit";
import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { saetzeLesen, satzAnlegen, satzEntfernen, satzFuer } from "../modules/projektzeit/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { antwort, koerper, kontextVon, ungueltig } from "./projektzeit-gemeinsam.ts";

const id = z.string().min(1).nullable().default(null);
const tag = z.string().refine(istTag);

/** A rate names an order or a customer, not both: the order brings its customer */
const neuSchema = z
  .object({
    kundeId: id,
    projektId: id,
    taetigkeitId: id,
    nutzerId: id,
    gueltigAb: tag.optional(),
    centProStunde: z.number().int().min(0).max(10_000_000),
  })
  .strict()
  .refine(({ kundeId, projektId }) => kundeId === null || projektId === null);

const giltSchema = z.object({
  projektId: z.string().min(1).nullable().default(null),
  taetigkeitId: z.string().min(1),
  nutzerId: z.string().min(1),
  tag,
});

/** The hourly rates of the caller's business: for owner and planner only (docs/plan.md) */
export const satzRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("projekte:verwalten"))
    .get("/", (c) => c.json({ saetze: saetzeLesen(db, c.get("betriebId")) }))
    .get("/gilt", (c) => {
      const eingabe = giltSchema.safeParse(c.req.query());
      if (!eingabe.success) return ungueltig(c);
      const ergebnis = satzFuer(db, c.get("betriebId"), eingabe.data);
      return antwort(c, ergebnis);
    })
    .post("/", async (c) => {
      const eingabe = neuSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      return antwort(c, satzAnlegen(db, schreibDb, kontextVon(c, jetzt), eingabe.data), 201);
    })
    .delete("/:satzId", (c) =>
      antwort(c, satzEntfernen(db, schreibDb, kontextVon(c, jetzt), c.req.param("satzId"))),
    );

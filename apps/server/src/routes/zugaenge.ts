import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  GUELTIGKEITEN,
  zugaengeVon,
  zugangAnlegen,
  zugangWiderrufen,
} from "../modules/zugaenge/index.ts";
import { type Anfrage, nurSitzung, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";

/** A name to recognise the token by, and an expiry in days from the choice, or none */
export const zugangSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    gueltigTage: z.union([...GUELTIGKEITEN.map((tage) => z.literal(tage)), z.null()]),
  })
  .strict();

/**
 * The caller's own personal access tokens in the business, below /api/v1/zugaenge (S-607): only with
 * a session, so a token never makes another; the token itself is in the answer to its creation only
 */
export const zugangRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("api:zugang"), nurSitzung)
    .get("/", (c) => c.json({ zugaenge: zugaengeVon(db, c.get("betriebId"), c.get("nutzerId")) }))
    .post("/", async (c) => {
      const eingabe = await koerper(c, zugangSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return c.json(zugangAnlegen(schreibDb, kontextVon(c, jetzt), eingabe.data), 201);
    })
    .delete("/:zugangId", (c) => {
      const weg = zugangWiderrufen(db, schreibDb, kontextVon(c, jetzt), c.req.param("zugangId"));
      return weg ? c.json({ ok: true }) : c.json({ fehler: "unbekannt" }, 404);
    });

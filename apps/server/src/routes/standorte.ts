import { LAENDER, REGIONEN, type Region } from "@soll/arbeitszeit";
import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { standortVerplant } from "../modules/dienstplan/index.ts";
import { standortAnlegen, standortEntfernen, standorteLesen } from "../modules/standorte/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

const REGION_NAMEN = Object.keys(REGIONEN) as [Region, ...Region[]];

/** A site; its regions must lie in its Land (REGIONEN in packages/arbeitszeit) */
export const standortSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    adresse: z.string().trim().max(200).default(""),
    land: z.enum(LAENDER),
    regionen: z.array(z.enum(REGION_NAMEN)).max(REGION_NAMEN.length).default([]),
  })
  .strict()
  .refine(({ land, regionen }) => regionen.every((region) => REGIONEN[region] === land));

/** The sites of the caller's business: everyone reads them, the owner changes them */
export const standortRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", recht("betrieb:lesen"), (c) =>
      c.json({ standorte: standorteLesen(db, c.get("betriebId")) }),
    )
    .post("/", recht("betrieb:einrichten"), async (c) => {
      // a body naming a business is refused (strict): the business is the session's
      const eingabe = standortSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      const regionen = [...new Set(eingabe.data.regionen)];
      return c.json(standortAnlegen(schreibDb, kontext, { ...eingabe.data, regionen }), 201);
    })
    .delete("/:standortId", recht("betrieb:einrichten"), (c) => {
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      // a site with shifts or need of the plan stays, its plan would be lost from every view (S-501)
      if (standortVerplant(db, kontext.betriebId, c.req.param("standortId")))
        return c.json({ fehler: "verplant" }, 409);
      if (!standortEntfernen(db, schreibDb, kontext, c.req.param("standortId")))
        return c.json({ fehler: "unbekannt" }, 404);
      return c.body(null, 204);
    });

import { istTag } from "@soll/arbeitszeit";
import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { modellAnlegen, modellEntfernen, modelleLesen } from "../modules/arbeitszeit/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

/** Whole minutes and cents only (CLAUDE.md, "Never": no floats for time or money) */
const minuten = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

/**
 * The surcharges a model pays in basis points (2500 = 25 %), whole numbers up to 1000 %; a rate left
 * out is not paid (`Zuschlagssaetze`, docs/zuschlaege.md "Sätze des Betriebs")
 */
const saetzeSchema = z.partialRecord(
  z.enum(["nacht", "nacht0bis4", "sonntag", "feiertag", "feiertag150", "heiligabend", "silvester"]),
  z.number().int().min(0).max(100_000),
);

export const modellSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    sollMinuten: z.array(minuten).length(7),
    lohnArt: z.enum(["monat", "stunde"]),
    lohnCent: z.number().int().min(0).max(100_000_000).nullable(),
    minijob: z.boolean(),
    pausenabzug: z.boolean().optional(),
    zuschlagssaetze: saetzeSchema.optional(),
    gueltigAb: z.string().refine(istTag).optional(),
  })
  .strict();

/**
 * The working-time models of the caller's business, below /api/v1/arbeitszeit: refused while the
 * module is off. Wages are for the owner and payroll (rollen.ts, "modelle:lesen").
 */
export const modellRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", recht("modelle:lesen"), (c) =>
      c.json({ modelle: modelleLesen(db, c.get("betriebId")) }),
    )
    .post("/", recht("betrieb:einrichten"), async (c) => {
      const eingabe = modellSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      return c.json(modellAnlegen(schreibDb, kontext, eingabe.data), 201);
    })
    .delete("/:modellId", recht("betrieb:einrichten"), (c) => {
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      const ergebnis = modellEntfernen(db, schreibDb, kontext, c.req.param("modellId"));
      if (!ergebnis.ok)
        return c.json({ fehler: ergebnis.grund }, ergebnis.grund === "unbekannt" ? 404 : 409);
      return c.body(null, 204);
    });

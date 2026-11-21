import { LAENDER } from "@soll/arbeitszeit";
import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { betriebEinrichten, einrichtungAbschliessen } from "../modules/betrieb/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

export const betriebSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    land: z.enum(LAENDER),
    fragen: z
      .object({
        beschaeftigte: z.boolean(),
        schichten: z.boolean(),
        kunden: z.boolean(),
        stempelort: z.boolean(),
      })
      .strict(),
  })
  .strict();

/** The setup of a business (S-303): its first step, and finishing it */
export const einrichtungRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("betrieb:einrichten"))
    .put("/betrieb", async (c) => {
      const eingabe = betriebSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      const ergebnis = betriebEinrichten(db, schreibDb, kontext, eingabe.data);
      if (!ergebnis.ok)
        return c.json({ fehler: ergebnis.grund }, ergebnis.grund === "kein_betrieb" ? 404 : 409);
      return c.json({ ok: true });
    })
    .post("/abschliessen", (c) => {
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      if (!einrichtungAbschliessen(db, schreibDb, kontext))
        return c.json({ fehler: "kein_betrieb" }, 404);
      return c.json({ ok: true });
    });

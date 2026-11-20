import { BRANCHEN, istTag } from "@soll/arbeitszeit";
import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  betriebLesen,
  moduleSetzen,
  moduleVon,
  pruefeinstellungenSetzen,
  pruefeinstellungenVon,
} from "../modules/betrieb/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

const moduleSchema = z
  .object({
    arbeitszeit: z.boolean(),
    dienstplan: z.boolean(),
    projektzeit: z.boolean(),
    terminal: z.boolean(),
  })
  .partial()
  .strict();

/** The settings the rules read (S-502); null keeps the default of the law */
const pruefungSchema = z
  .object({
    branche: z.enum(BRANCHEN).nullable(),
    // § 10 Abs. 1 Nr. 1 to 16 ArbZG
    sonntagsausnahme: z.number().int().min(1).max(16).nullable(),
    ausgleichszeitraum: z.enum(["sechs_monate", "24_wochen"]).nullable(),
    ausgleichBeginn: z.string().refine(istTag).nullable(),
  })
  .strict();

/** The caller's business, its modules and the settings of the rules */
export const betriebRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", recht("betrieb:lesen"), (c) => {
      const betrieb = betriebLesen(db, c.get("betriebId"));
      if (!betrieb) return c.json({ fehler: "kein_betrieb" }, 404);
      return c.json({
        betriebId: betrieb.betriebId,
        // the person signed in: what the device keeps offline belongs to one person (S-305)
        nutzerId: c.get("nutzerId"),
        name: betrieb.name,
        land: betrieb.land,
        eingerichtet: betrieb.eingerichtetAm !== null,
        // one's own role, so the app knows what to offer (the server checks it again on each call)
        rolle: c.get("rolle"),
        module: moduleVon(betrieb),
      });
    })
    .patch("/module", recht("betrieb:module"), async (c) => {
      const eingabe = moduleSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      const ergebnis = moduleSetzen(db, schreibDb, kontext, eingabe.data);
      if (!ergebnis.ok)
        return c.json({ fehler: ergebnis.grund }, ergebnis.grund === "kein_betrieb" ? 404 : 409);
      return c.json({ module: ergebnis.module });
    })
    .get("/pruefung", recht("betrieb:lesen"), (c) => {
      const betrieb = betriebLesen(db, c.get("betriebId"));
      if (!betrieb) return c.json({ fehler: "kein_betrieb" }, 404);
      return c.json(pruefeinstellungenVon(betrieb));
    })
    .put("/pruefung", recht("betrieb:einrichten"), async (c) => {
      const eingabe = pruefungSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      if (!betriebLesen(db, c.get("betriebId"))) return c.json({ fehler: "kein_betrieb" }, 404);
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      return c.json(pruefeinstellungenSetzen(schreibDb, kontext, eingabe.data));
    });

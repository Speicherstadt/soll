import { Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  betriebLesen,
  hinweisBestaetigen,
  hinweisVon,
  moduleSetzen,
  moduleVon,
} from "../modules/betrieb/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

export const moduleSchema = z
  .object({
    arbeitszeit: z.boolean(),
    dienstplan: z.boolean(),
    projektzeit: z.boolean(),
    terminal: z.boolean(),
  })
  .partial()
  .strict();

/** The caller's business and its modules */
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
        // what Soll changed by itself and tells the owner, who switches the modules (S-603)
        hinweis: darf(c.get("rolle"), "betrieb:module") ? hinweisVon(betrieb) : null,
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
    .delete("/hinweis", recht("betrieb:module"), (c) => {
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      hinweisBestaetigen(db, schreibDb, kontext);
      return c.body(null, 204);
    });

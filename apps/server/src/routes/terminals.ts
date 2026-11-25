import { Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { mitgliederMitNamen, mitgliedschaftVon } from "../modules/mitglieder/index.ts";
import { mitPin } from "../modules/pin/index.ts";
import {
  ausweisAusstellen,
  ausweisEntziehen,
  kopplungAnlegen,
  mitAusweis,
  offlineStand,
  terminalEntsperren,
  terminalsVon,
  terminalWiderrufen,
} from "../modules/terminal/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { kontextVon } from "./stempel-antwort.ts";

export const kopplungSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();

/**
 * The owner's side of the terminal (S-801), below /api/v1/terminal behind the module's switch:
 * pairing codes and the list of terminals, revoking one or lifting its lock, and the people with
 * PIN and QR code
 */
export const terminalRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("terminal:verwalten"))
    // each with the gaps in the numbers of its offline queue and the entries refused (S-803)
    .get("/geraete", (c) => {
      const betriebId = c.get("betriebId");
      const terminals = terminalsVon(db, betriebId, jetzt()).map((terminal) => ({
        ...terminal,
        offline: offlineStand(db, betriebId, terminal.terminalId),
      }));
      return c.json({ terminals });
    })
    .get("/personen", (c) => {
      const betriebId = c.get("betriebId");
      const pins = mitPin(db, betriebId);
      const ausweise = mitAusweis(db, betriebId);
      const personen = mitgliederMitNamen(db, betriebId)
        .filter((mitglied) => darf(mitglied.rolle, "stempeln"))
        .map(({ nutzerId, name }) => ({
          nutzerId,
          name,
          pin: pins.has(nutzerId),
          ausweis: ausweise.has(nutzerId),
        }));
      return c.json({ personen });
    })
    .post("/geraete", async (c) => {
      const eingabe = kopplungSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return c.json(kopplungAnlegen(schreibDb, kontextVon(c, jetzt), eingabe.data.name), 201);
    })
    .delete("/geraete/:terminalId", (c) =>
      terminalWiderrufen(db, schreibDb, kontextVon(c, jetzt), c.req.param("terminalId"))
        ? c.body(null, 204)
        : c.json({ fehler: "unbekannt" }, 404),
    )
    .post("/geraete/:terminalId/entsperren", (c) =>
      terminalEntsperren(db, schreibDb, kontextVon(c, jetzt), c.req.param("terminalId"))
        ? c.body(null, 204)
        : c.json({ fehler: "unbekannt" }, 404),
    )
    .post("/ausweise/:nutzerId", (c) => {
      const nutzerId = c.req.param("nutzerId");
      const mitglied = mitgliedschaftVon(db, c.get("betriebId"), nutzerId);
      if (!mitglied || !darf(mitglied.rolle, "stempeln"))
        return c.json({ fehler: "unbekannt" }, 404);
      return c.json(
        { wert: ausweisAusstellen(db, schreibDb, kontextVon(c, jetzt), nutzerId) },
        201,
      );
    })
    .delete("/ausweise/:nutzerId", (c) =>
      ausweisEntziehen(db, schreibDb, kontextVon(c, jetzt), c.req.param("nutzerId"))
        ? c.body(null, 204)
        : c.json({ fehler: "unbekannt" }, 404),
    );

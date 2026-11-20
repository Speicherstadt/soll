import { tagInBerlin } from "@soll/arbeitszeit";
import { Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db } from "../db/oeffnen.ts";
import { auskunftVon, warMitglied } from "../modules/auskunft/index.ts";
import type { Anfrage } from "./kontext.ts";

export const abfrageSchema = z.object({ nutzerId: z.string().min(1).max(100).optional() }).strict();

/**
 * The Auskunft under Art. 15 DSGVO below /api/v1/auskunft (S-309): every signed-in member gets their
 * own, the owner also that of someone who is or was a member (`auskunft:erteilen`). Not behind a
 * module switch: the right does not depend on what the business uses.
 */
export const auskunftRouten = (db: Db, jetzt: () => number) =>
  new Hono<Anfrage>().get("/", (c) => {
    const eingabe = abfrageSchema.safeParse(c.req.query());
    if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    const betriebId = c.get("betriebId");
    const ziel = eingabe.data.nutzerId ?? c.get("nutzerId");
    if (ziel !== c.get("nutzerId")) {
      if (!darf(c.get("rolle"), "auskunft:erteilen"))
        return c.json({ fehler: "keine_berechtigung" }, 403);
      if (!warMitglied(db, betriebId, ziel)) return c.json({ fehler: "unbekannt" }, 404);
    }
    const zeitpunkt = jetzt();
    const auskunft = auskunftVon(db, betriebId, ziel, {
      jetzt: zeitpunkt,
      fuerSich: ziel === c.get("nutzerId"),
    });
    return c.body(`${JSON.stringify(auskunft, null, 2)}\n`, 200, {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="auskunft-${tagInBerlin(zeitpunkt)}.json"`,
    });
  });

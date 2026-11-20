import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { mitgliedschaftVon } from "../modules/mitglieder/index.ts";
import { istNeuePin, istPin, pinPruefen, pinSetzen } from "../modules/pin/index.ts";
import { pinKennung } from "../modules/terminal/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

const pinSchema = z.object({ pin: z.string().refine(istPin) }).strict();
const neuePinSchema = z.object({ pin: z.string().refine(istNeuePin) }).strict();

const kontextVon = (
  c: { get: (key: "betriebId" | "nutzerId") => string },
  jetzt: () => number,
) => ({
  betriebId: c.get("betriebId"),
  akteur: c.get("nutzerId"),
  jetzt: jetzt(),
});

/**
 * The PINs of the terminal, below /api/v1/terminal/pins, so they are refused with the module Terminal
 * (S-603): PUT /:nutzerId, the owner sets a member's PIN of 6 to 8 digits, which also lifts a lock; a
 * PIN another member holds is refused (409 `pin_vergeben`), as the terminal finds a person by the PIN
 * alone (S-801); POST /:nutzerId/pruefen, the terminal checks one
 */
export const pinRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  pinSchluessel: Uint8Array,
) =>
  new Hono<Anfrage>()
    .put("/:nutzerId", recht("pin:setzen"), async (c) => {
      const nutzerId = c.req.param("nutzerId");
      if (!mitgliedschaftVon(db, c.get("betriebId"), nutzerId))
        return c.json({ fehler: "unbekannt" }, 404);
      const eingabe = neuePinSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const { pin } = eingabe.data;
      const kennung = pinKennung(pinSchluessel, c.get("betriebId"), pin);
      const ergebnis = await pinSetzen(db, schreibDb, kontextVon(c, jetzt), nutzerId, {
        pin,
        kennung,
      });
      if (ergebnis === "vergeben") return c.json({ fehler: "pin_vergeben" }, 409);
      return c.body(null, 204);
    })
    .post("/:nutzerId/pruefen", recht("pin:pruefen"), async (c) => {
      // a PIN outlives a membership in its table; a person who left the business is unknown here
      if (!mitgliedschaftVon(db, c.get("betriebId"), c.req.param("nutzerId")))
        return c.json({ ergebnis: "unbekannt" }, 404);
      const eingabe = pinSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const ergebnis = await pinPruefen(
        db,
        schreibDb,
        kontextVon(c, jetzt),
        c.req.param("nutzerId"),
        eingabe.data.pin,
      );
      if (ergebnis === "ok") return c.json({ ergebnis }, 200);
      return c.json(
        { ergebnis },
        ergebnis === "gesperrt" ? 423 : ergebnis === "unbekannt" ? 404 : 401,
      );
    });

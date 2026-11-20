import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { mitgliedschaftVon } from "../modules/mitglieder/index.ts";
import { istPin, pinPruefen, pinSetzen } from "../modules/pin/index.ts";
import { type Anfrage, modul, recht } from "./kontext.ts";

const pinSchema = z.object({ pin: z.string().refine(istPin) }).strict();

const kontextVon = (
  c: { get: (key: "betriebId" | "nutzerId") => string },
  jetzt: () => number,
) => ({
  betriebId: c.get("betriebId"),
  akteur: c.get("nutzerId"),
  jetzt: jetzt(),
});

/** PUT /api/v1/pins/:nutzerId: the owner sets a member's PIN, which also lifts a lock */
export const pinRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>().put("/:nutzerId", recht("pin:setzen"), async (c) => {
    const nutzerId = c.req.param("nutzerId");
    if (!mitgliedschaftVon(db, c.get("betriebId"), nutzerId))
      return c.json({ fehler: "unbekannt" }, 404);
    const eingabe = pinSchema.safeParse(await c.req.json().catch(() => null));
    if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    await pinSetzen(db, schreibDb, kontextVon(c, jetzt), nutzerId, eingabe.data.pin);
    return c.body(null, 204);
  });

/** POST /api/v1/terminal/pins/:nutzerId/pruefen: the terminal checks a PIN (module Terminal) */
export const pinPruefRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>().post(
    "/:nutzerId/pruefen",
    modul(db, "terminal"),
    recht("pin:pruefen"),
    async (c) => {
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
    },
  );

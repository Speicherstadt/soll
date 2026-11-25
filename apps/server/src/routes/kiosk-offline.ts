import type { Context } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  type OfflineAbhaengigkeiten,
  type OfflineErgebnis,
  offlineEintragAnnehmen,
  terminalSchluesselAnmelden,
} from "../modules/terminal/index.ts";
import type { KioskAnfrage } from "./kiosk.ts";
import { anmeldeSchema } from "./offline.ts";
import { art, zeitpunkt } from "./stempel-antwort.ts";

/** ECDSA P-256 with SHA-256 from WebCrypto, base64url (as in S-305) */
const signatur = z.string().regex(/^[A-Za-z0-9_-]{86}$/);
/** The encrypted credential: point, nonce, the padded credential and the tag, base64url */
const ausweis = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .max(1000);

export const kioskOfflineSchema = z
  .object({
    nummer: z.number().int().min(1).max(2_147_483_647),
    art,
    geraetZeitpunkt: zeitpunkt,
    gesendetAm: zeitpunkt,
    ausweis,
    signatur,
  })
  .strict();

const GRUND_STATUS = { signatur: 422, schluessel_fehlt: 409, doppelt: 409 } as const;

/**
 * The answer to an entry: 201 with the stamp's id for a new one, 200 for the same entry again; 422
 * with the reason for an entry refused and kept (the tablet does not send it again, also `gesperrt`)
 * and 409 `schluessel_fehlt` before its key is registered (the entry waits)
 */
const antwort = (c: Context<KioskAnfrage>, ergebnis: OfflineErgebnis) => {
  if (ergebnis.art === "gestempelt")
    return c.json({ stempelId: ergebnis.stempelId }, ergebnis.vorhanden ? 200 : 201);
  if (ergebnis.art === "abgelehnt") return c.json({ fehler: ergebnis.grund }, 422);
  return c.json({ fehler: ergebnis.fehler }, GRUND_STATUS[ergebnis.fehler]);
};

/**
 * PUT /api/v1/kiosk/schluessel: the tablet registers the public half of its non-extractable key
 * (S-803); 201 when new, 200 again with the same key, 409 when the terminal has another
 */
export const schluesselRoute =
  (db: Db, schreibDb: SchreibDb, jetzt: () => number) => async (c: Context<KioskAnfrage>) => {
    const eingabe = anmeldeSchema.safeParse(await c.req.json().catch(() => null));
    if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    const ergebnis = await terminalSchluesselAnmelden(
      db,
      schreibDb,
      c.get("terminal"),
      eingabe.data.schluessel,
      jetzt(),
    );
    if (!ergebnis.ok)
      return c.json({ fehler: ergebnis.grund }, ergebnis.grund === "vergeben" ? 409 : 400);
    return c.json({ terminalId: c.get("terminal").terminalId }, ergebnis.neu ? 201 : 200);
  };

/** POST /api/v1/kiosk/offline: an entry of the tablet's offline queue (S-803) */
export const offlineRoute = (abh: OfflineAbhaengigkeiten) => async (c: Context<KioskAnfrage>) => {
  const eingabe = kioskOfflineSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
  return antwort(c, await offlineEintragAnnehmen(abh, c.get("terminal"), eingabe.data));
};

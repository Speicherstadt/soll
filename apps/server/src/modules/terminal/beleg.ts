import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * A SUN message counts once (sun.ts, read counter), yet the person recognised by it still picks
 * Kommen, Pause or Gehen. So the terminal gets a receipt instead (S-802): terminal, person and
 * expiry, signed with HMAC-SHA-256 under a key derived for this purpose. It names the person only
 * at the terminal it was issued to, and only for as long as the kiosk shows the person.
 */

/** A little longer than the kiosk shows a person (15 s), for the way to the server */
export const BELEG_GILT_MS = 20_000;

const mac = (schluessel: Uint8Array, inhalt: string): Buffer =>
  createHmac("sha256", schluessel).update(inhalt).digest();

export const belegAusstellen = (
  schluessel: Uint8Array,
  fuer: { terminalId: string; nutzerId: string },
  jetzt: number,
): string => {
  const inhalt = Buffer.from(
    JSON.stringify([fuer.terminalId, fuer.nutzerId, jetzt + BELEG_GILT_MS]),
  ).toString("base64url");
  return `${inhalt}.${mac(schluessel, inhalt).toString("base64url")}`;
};

const gelesen = (inhalt: string): [string, string, number] | undefined => {
  try {
    const wert: unknown = JSON.parse(Buffer.from(inhalt, "base64url").toString("utf8"));
    if (!Array.isArray(wert) || wert.length !== 3) return undefined;
    const [terminalId, nutzerId, bis] = wert;
    return typeof terminalId === "string" && typeof nutzerId === "string" && typeof bis === "number"
      ? [terminalId, nutzerId, bis]
      : undefined;
  } catch {
    return undefined;
  }
};

/** The person of a receipt, if it is genuine, for this terminal and still holds */
export const belegPruefen = (
  schluessel: Uint8Array,
  beleg: string,
  terminalId: string,
  jetzt: number,
): string | undefined => {
  const [inhalt = "", gegeben = ""] = beleg.split(".");
  const erwartet = mac(schluessel, inhalt);
  const geprueft = Buffer.from(gegeben, "base64url");
  if (geprueft.length !== erwartet.length || !timingSafeEqual(geprueft, erwartet)) return undefined;
  const werte = gelesen(inhalt);
  if (!werte || werte[0] !== terminalId || werte[2] <= jetzt) return undefined;
  return werte[1];
};

import { createHmac, hkdfSync, randomBytes } from "node:crypto";
import { sha256 } from "../audit/hash.ts";

/** A device token or a QR code: 32 random bytes, base64url; only its SHA-256 is stored */
export const zufallsToken = (): string => randomBytes(32).toString("base64url");

/** SHA-256 of a random token, as the tables keep it (like the invitations of S-106) */
export const tokenHash = (token: string): string => sha256(token);

/**
 * The letters of a pairing code: 32 of them, without 0, O, 1 and I, which are easily confused when
 * typed on a tablet; 8 letters carry 40 bits
 */
export const CODE_ZEICHEN = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LAENGE = 8;

/** A pairing code; 256 is a multiple of 32, so each byte gives an evenly drawn letter */
export const kopplungscode = (): string =>
  [...randomBytes(CODE_LAENGE)].map((byte) => CODE_ZEICHEN[byte % CODE_ZEICHEN.length]).join("");

/** A code as typed: case, spaces and the dash in the middle do not count */
export const codeNormalisieren = (eingabe: string): string =>
  eingabe.toUpperCase().replace(/[\s-]/g, "");

/**
 * The key for the PIN lookup, derived from SOLL_SECRET_KEY with HKDF (RFC 5869), so the key of the
 * encrypted columns is never used for anything else
 */
export const pinSchluesselAus = (geheimerSchluessel: Uint8Array): Uint8Array =>
  new Uint8Array(hkdfSync("sha256", geheimerSchluessel, new Uint8Array(0), "soll pin-kennung", 32));

/**
 * The keyed hash by which the terminal finds a person from a PIN alone (docs/plan.md, "PIN am
 * Terminal"): HMAC-SHA-256 over business and PIN. Without the key the stored value tells nothing,
 * not even whether two businesses share a PIN.
 */
export const pinKennung = (schluessel: Uint8Array, betriebId: string, pin: string): string =>
  createHmac("sha256", schluessel).update(`${betriebId}\n${pin}`).digest("hex");

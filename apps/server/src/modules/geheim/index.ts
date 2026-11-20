import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/*
 * Encrypted columns (CLAUDE.md, "Secrets"): AES-256-GCM with the key from SOLL_SECRET_KEY. The
 * purpose (e.g. "vapid") is the additional data, so a value cannot be moved into another column.
 * Stored as "v1." + base64url(nonce ‖ tag ‖ ciphertext).
 */

const VERSION = "v1.";
const NONCE = 12;
const TAG = 16;

export const verschluesseln = (schluessel: Uint8Array, zweck: string, klartext: string): string => {
  const nonce = randomBytes(NONCE);
  const chiffre = createCipheriv("aes-256-gcm", schluessel, nonce);
  chiffre.setAAD(Buffer.from(zweck, "utf8"));
  const text = Buffer.concat([chiffre.update(klartext, "utf8"), chiffre.final()]);
  return VERSION + Buffer.concat([nonce, chiffre.getAuthTag(), text]).toString("base64url");
};

/** The plain text, or an error as a value for another key, purpose or a changed value */
export const entschluesseln = (
  schluessel: Uint8Array,
  zweck: string,
  wert: string,
): { ok: true; wert: string } | { ok: false } => {
  if (!wert.startsWith(VERSION)) return { ok: false };
  const roh = Buffer.from(wert.slice(VERSION.length), "base64url");
  if (roh.length < NONCE + TAG) return { ok: false };
  try {
    const entschluessler = createDecipheriv("aes-256-gcm", schluessel, roh.subarray(0, NONCE));
    entschluessler.setAAD(Buffer.from(zweck, "utf8"));
    entschluessler.setAuthTag(roh.subarray(NONCE, NONCE + TAG));
    const text = Buffer.concat([
      entschluessler.update(roh.subarray(NONCE + TAG)),
      entschluessler.final(),
    ]);
    return { ok: true, wert: text.toString("utf8") };
  } catch {
    return { ok: false };
  }
};

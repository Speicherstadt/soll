import type { Stempelart } from "../arbeitstag/stempelungen.ts";

/**
 * The offline queue of a tablet terminal (S-803): what the tablet signs for an entry, and how it
 * hides the person's credential from itself. Shared by the server and the app, so both sides sign,
 * check, encrypt and decrypt the same bytes (docs/plan.md, "Warteschlange am Terminal").
 */

/** An entry of a terminal's queue as the tablet signs it */
export type Terminaleintrag = {
  terminalId: string;
  /** running number per terminal, from 1, over every person who stamps there */
  nummer: number;
  art: Stempelart;
  /** the tablet's clock when the person stamped, UTC milliseconds */
  geraetZeitpunkt: number;
  /** the credential (PIN, QR value, card with PIN or SUN message), encrypted to the server */
  ausweis: string;
};

/** The version of the signed text, as `stempelNachricht` has its own */
const VERSION = "soll/terminal-stempel/1";

/** The text a tablet signs: a JSON array in a fixed order, like `stempelNachricht` (offline.ts) */
export const terminalNachricht = (eintrag: Terminaleintrag): string =>
  JSON.stringify([
    VERSION,
    eintrag.terminalId,
    eintrag.nummer,
    eintrag.art,
    eintrag.geraetZeitpunkt,
    eintrag.ausweis,
  ]);

/**
 * The length every credential is padded to before it is encrypted: the longest (a QR value of 200
 * characters in JSON) fits, and the length of the cipher text tells neither the kind of credential
 * nor the number of digits of a PIN
 */
export const AUSWEIS_LAENGE = 256;

/** The purpose in HKDF, so this key serves nothing else; the server opens with the same */
export const AUSWEIS_ZWECK = "soll terminal-ausweis/1";
const KURVE = { name: "ECDH", namedCurve: "P-256" } as const;
/** An uncompressed point of P-256 (0x04 ‖ x ‖ y) and the nonce of AES-GCM */
export const PUNKT_BYTES = 65;
export const NONCE_BYTES = 12;

const utf8 = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

export const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

/**
 * Encrypts a credential to the server's public key (ECIES): a fresh ECDH key pair on P-256 per
 * entry, HKDF-SHA-256 over the shared secret with the fresh public key as salt, AES-256-GCM with
 * `zusatz` (the terminal) as additional data. The result is base64url of the fresh public key, the
 * nonce and the cipher text with its tag. Only the server's private key opens it, so a tablet that
 * is stolen or read out holds no PIN in the clear (docs/plan.md, "Ausweis in der Warteschlange").
 */
export const ausweisVerschluesseln = async (
  subtle: SubtleCrypto,
  empfaenger: { kty: string; crv: string; x: string; y: string },
  klartext: string,
  zusatz: string,
): Promise<string> => {
  const server = await subtle.importKey(
    "jwk",
    { kty: empfaenger.kty, crv: empfaenger.crv, x: empfaenger.x, y: empfaenger.y },
    KURVE,
    false,
    [],
  );
  const einmal = await subtle.generateKey(KURVE, false, ["deriveBits"]);
  const punkt = new Uint8Array(await subtle.exportKey("raw", einmal.publicKey));
  const geteilt = await subtle.deriveBits({ name: "ECDH", public: server }, einmal.privateKey, 256);
  const hkdf = await subtle.importKey("raw", geteilt, "HKDF", false, ["deriveKey"]);
  const schluessel = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: punkt, info: utf8(AUSWEIS_ZWECK) },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const chiffre = await subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: utf8(zusatz) },
    schluessel,
    utf8(klartext.padEnd(AUSWEIS_LAENGE)),
  );
  return base64url(new Uint8Array([...punkt, ...nonce, ...new Uint8Array(chiffre)]));
};

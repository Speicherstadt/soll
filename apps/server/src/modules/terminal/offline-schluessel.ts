import { createDecipheriv, createECDH, hkdfSync } from "node:crypto";
import { AUSWEIS_ZWECK, NONCE_BYTES, PUNKT_BYTES } from "@soll/arbeitszeit";

/**
 * The server's key pair for the credentials in a terminal's offline queue (S-803): the tablet
 * encrypts each credential to the public half (`ausweisVerschluesseln` in @soll/arbeitszeit), only
 * the server opens it. The pair is derived from SOLL_SECRET_KEY with HKDF under a purpose of its
 * own, so it needs no storage of its own and is the same after every restart (docs/plan.md,
 * "Ausweis in der Warteschlange").
 */

/** A public key of P-256 as JWK, as GET /api/v1/kiosk hands it to the tablet */
export type OeffentlicherAusweisSchluessel = { kty: "EC"; crv: "P-256"; x: string; y: string };

export type AusweisSchluessel = {
  /** the private scalar, 32 bytes */
  privat: Uint8Array;
  oeffentlich: OeffentlicherAusweisSchluessel;
};

const KURVE = "prime256v1";
const TAG_BYTES = 16;

/**
 * The pair from the instance's secret: HKDF gives 32 bytes as the private scalar; the rare value
 * that is no valid scalar of P-256 (0 or not below the group order, about 2⁻³²) takes the next round
 */
export const ausweisSchluesselAus = (geheimerSchluessel: Uint8Array): AusweisSchluessel => {
  for (let runde = 0; ; runde++) {
    const zweck = runde === 0 ? "soll kiosk-ausweis" : `soll kiosk-ausweis ${runde}`;
    const privat = new Uint8Array(
      hkdfSync("sha256", geheimerSchluessel, new Uint8Array(0), zweck, 32),
    );
    const ecdh = createECDH(KURVE);
    try {
      ecdh.setPrivateKey(privat);
    } catch {
      continue;
    }
    const punkt = ecdh.getPublicKey();
    return {
      privat,
      oeffentlich: {
        kty: "EC",
        crv: "P-256",
        x: punkt.subarray(1, 33).toString("base64url"),
        y: punkt.subarray(33, 65).toString("base64url"),
      },
    };
  }
};

/**
 * Opens a credential the tablet encrypted for terminal `zusatz`: ECDH with the fresh public key in
 * front, HKDF-SHA-256 with that key as salt, AES-256-GCM with the terminal as additional data; the
 * padding is cut off. Anything that does not open (another terminal, a changed byte) is null.
 */
export const ausweisOeffnen = (
  privat: Uint8Array,
  chiffre: string,
  zusatz: string,
): string | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(chiffre)) return null;
  const bytes = Buffer.from(chiffre, "base64url");
  if (bytes.length < PUNKT_BYTES + NONCE_BYTES + TAG_BYTES) return null;
  const punkt = bytes.subarray(0, PUNKT_BYTES);
  const nonce = bytes.subarray(PUNKT_BYTES, PUNKT_BYTES + NONCE_BYTES);
  const inhalt = bytes.subarray(PUNKT_BYTES + NONCE_BYTES, bytes.length - TAG_BYTES);
  try {
    const ecdh = createECDH(KURVE);
    ecdh.setPrivateKey(privat);
    const geteilt = ecdh.computeSecret(punkt);
    const schluessel = Buffer.from(hkdfSync("sha256", geteilt, punkt, AUSWEIS_ZWECK, 32));
    const entschluesseln = createDecipheriv("aes-256-gcm", schluessel, nonce);
    entschluesseln.setAAD(Buffer.from(zusatz, "utf8"));
    entschluesseln.setAuthTag(bytes.subarray(bytes.length - TAG_BYTES));
    const klar = Buffer.concat([entschluesseln.update(inhalt), entschluesseln.final()]);
    return klar.toString("utf8").trimEnd();
  } catch {
    return null;
  }
};

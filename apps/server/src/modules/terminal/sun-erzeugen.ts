import { createCipheriv, randomBytes } from "node:crypto";
import { PICC_DATA_TAG, type Sun, type SunSchluessel, sdmMac } from "./sun.ts";

/**
 * What an NTAG 424 DNA puts into its URL on a read, for tests only (the stand-in for a card): the
 * PICCData with tag, UID, read counter (least significant byte first) and random padding, encrypted
 * with the SDMMetaReadKey, and the SDMMAC (AN12196, section 3.4)
 */
export const sunErzeugen = (
  schluessel: SunSchluessel,
  uid: string,
  zaehler: number,
  optionen: { tag?: number } = {},
): Sun => {
  const uidUndZaehler = new Uint8Array([
    ...Buffer.from(uid, "hex"),
    zaehler & 0xff,
    (zaehler >> 8) & 0xff,
    (zaehler >> 16) & 0xff,
  ]);
  const klartext = Buffer.concat([
    Buffer.from([optionen.tag ?? PICC_DATA_TAG]),
    uidUndZaehler,
    randomBytes(16 - 1 - uidUndZaehler.length),
  ]);
  const chiffre = createCipheriv("aes-128-cbc", schluessel.meta, new Uint8Array(16));
  chiffre.setAutoPadding(false);
  const e = Buffer.concat([chiffre.update(klartext), chiffre.final()]);
  return {
    e: e.toString("hex").toUpperCase(),
    c: Buffer.from(sdmMac(schluessel.datei, uidUndZaehler)).toString("hex").toUpperCase(),
  };
};

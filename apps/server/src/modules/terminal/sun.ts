import { createDecipheriv, timingSafeEqual } from "node:crypto";
import { aesCmac } from "./cmac.ts";

/*
 * The SUN message (Secure Unique NFC, "SDM") of an NTAG 424 DNA in AES mode, after NXP AN12196,
 * "NTAG 424 DNA and NTAG 424 DNA TagTamper features and hints", section 3: the card mirrors into
 * its URL the encrypted PICCData (`e`, 16 bytes) and the SDMMAC (`c`, 8 bytes). Soll supports the
 * configuration of the example in section 3.4: PICCData with UID and read counter, the MAC over an
 * empty input (SDMMACInputOffset = SDMMACOffset), no SDMEncFileData. Cross-checked with
 * nfc-developer/sdm-backend (libsdm/sdm.py).
 */

export type SunSchluessel = { meta: Uint8Array; datei: Uint8Array };
/** The two values from the card's URL, as hex */
export type Sun = { e: string; c: string };
export type SunErgebnis = { ok: true; uid: string; zaehler: number } | { ok: false };

/** PICCDataTag: UID mirrored (bit 7), read counter mirrored (bit 6), UID of 7 bytes */
export const PICC_DATA_TAG = 0xc7;
/** SV2 for the session MAC key (AN12196, section 3.3): 3C C3 00 01 00 80 ‖ UID ‖ SDMReadCtr */
const SV2_KOPF = [0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80];
const UID_LAENGE = 7;

const hex = (wert: string, bytes: number): Buffer | null =>
  new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`).test(wert) ? Buffer.from(wert, "hex") : null;

/** PICCData = AES-128-CBC decrypted with the SDMMetaReadKey and an IV of zeros */
const piccData = (meta: Uint8Array, e: Uint8Array): Buffer => {
  const entschluessler = createDecipheriv("aes-128-cbc", meta, new Uint8Array(16));
  entschluessler.setAutoPadding(false);
  return Buffer.concat([entschluessler.update(e), entschluessler.final()]);
};

/**
 * SDMMAC: CMAC with the session key K_SesSDMFileReadMAC = CMAC(SDMFileReadKey, SV2) over the MAC
 * input (here empty), truncated to the bytes at odd positions (AN12196, section 3.4)
 */
export const sdmMac = (datei: Uint8Array, uidUndZaehler: Uint8Array): Uint8Array => {
  const sitzung = aesCmac(datei, new Uint8Array([...SV2_KOPF, ...uidUndZaehler]));
  return aesCmac(sitzung, new Uint8Array(0)).filter((_, i) => i % 2 === 1);
};

/**
 * Checks a SUN message with a card's keys: the UID (hex, upper case) and the read counter when the
 * PICCData decrypts to a mirrored UID and counter and the MAC holds; otherwise only `ok: false`, so
 * a forged message learns nothing about why. The caller compares the counter with the last one.
 */
export const sunPruefen = (schluessel: SunSchluessel, sun: Sun): SunErgebnis => {
  const e = hex(sun.e, 16);
  const c = hex(sun.c, 8);
  if (!e || !c) return { ok: false };
  const daten = piccData(schluessel.meta, e);
  if (daten[0] !== PICC_DATA_TAG) return { ok: false };
  const uidUndZaehler = daten.subarray(1, 1 + UID_LAENGE + 3);
  if (!timingSafeEqual(sdmMac(schluessel.datei, uidUndZaehler), c)) return { ok: false };
  const zaehler = daten.subarray(1 + UID_LAENGE, 1 + UID_LAENGE + 3);
  return {
    ok: true,
    uid: daten
      .subarray(1, 1 + UID_LAENGE)
      .toString("hex")
      .toUpperCase(),
    // SDMReadCtr is mirrored least significant byte first
    zaehler: (zaehler[0] ?? 0) | ((zaehler[1] ?? 0) << 8) | ((zaehler[2] ?? 0) << 16),
  };
};

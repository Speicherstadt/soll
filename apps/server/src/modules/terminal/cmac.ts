import { createCipheriv } from "node:crypto";

/*
 * AES-128 CMAC after RFC 4493 (NIST SP 800-38B) with node:crypto, for the SUN message of an
 * NTAG 424 DNA (sun.ts). Node has AES but no CMAC; the subkeys and the padding follow section 2.
 */

const BLOCK = 16;
const RB = 0x87;

/** AES-128 of one block, no chaining (the "AES-128(K, …)" of RFC 4493) */
const aes = (schluessel: Uint8Array, block: Uint8Array): Uint8Array => {
  const chiffre = createCipheriv("aes-128-ecb", schluessel, null);
  chiffre.setAutoPadding(false);
  return new Uint8Array(Buffer.concat([chiffre.update(block), chiffre.final()]));
};

/** One bit to the left; the carried bit folds in Rb (RFC 4493, 2.3, Generate_Subkey) */
const verdoppeln = (block: Uint8Array): Uint8Array => {
  const ergebnis = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) ergebnis[i] = ((block[i] ?? 0) << 1) | ((block[i + 1] ?? 0) >> 7);
  if (((block[0] ?? 0) & 0x80) !== 0) ergebnis[BLOCK - 1] = (ergebnis[BLOCK - 1] ?? 0) ^ RB;
  return ergebnis;
};

const xor = (a: Uint8Array, b: Uint8Array): Uint8Array => a.map((wert, i) => wert ^ (b[i] ?? 0));

/** The last block: XOR K1 when complete, else padded with 10…0 and XOR K2 (RFC 4493, 2.4) */
const letzterBlock = (schluessel: Uint8Array, rest: Uint8Array): Uint8Array => {
  const k1 = verdoppeln(aes(schluessel, new Uint8Array(BLOCK)));
  if (rest.length === BLOCK) return xor(rest, k1);
  const gepolstert = new Uint8Array(BLOCK);
  gepolstert.set(rest);
  gepolstert[rest.length] = 0x80;
  return xor(gepolstert, verdoppeln(k1));
};

/** The 16-byte CMAC of a message under an AES-128 key */
export const aesCmac = (schluessel: Uint8Array, nachricht: Uint8Array): Uint8Array => {
  const bloecke = Math.max(1, Math.ceil(nachricht.length / BLOCK));
  let x: Uint8Array = new Uint8Array(BLOCK);
  for (let i = 0; i < bloecke - 1; i++)
    x = aes(schluessel, xor(x, nachricht.subarray(i * BLOCK, (i + 1) * BLOCK)));
  const rest = nachricht.subarray((bloecke - 1) * BLOCK);
  return aes(schluessel, xor(x, letzterBlock(schluessel, rest)));
};

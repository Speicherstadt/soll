import { Inflate } from "fflate";

/*
 * The entries of a ZIP file (APPNOTE.TXT of PKWARE, sections 4.3.12 to 4.3.16), as far as an Excel
 * workbook needs them: the central directory read from its end, then each entry inflated on demand
 * with `fflate` within a budget of bytes. A workbook is a ZIP of XML files (ECMA-376 Part 2), and a
 * ZIP that inflates to gigabytes ("zip bomb") is cut off as soon as it passes the budget, before
 * more is made (BAULISTE.md S-702). Encrypted entries, ZIP64 and methods other than "stored" and
 * "deflate" are refused: Excel writes none of them for a sheet.
 */

export type ZipEintrag = { name: string; methode: number; start: number; laenge: number };

/** How many bytes the entries of one file may still inflate to; shared by every entry read */
export type Budget = { rest: number };

/** The most entries a workbook may list; Excel writes about a dozen */
const MAX_EINTRAEGE = 1000;
const EOCD = 0x06054b50;
const ZENTRAL = 0x02014b50;
const LOKAL = 0x04034b50;
/** Inflated in pieces this large, so one push makes at most about 1 MiB (deflate's limit 1032:1) */
const STUECK = 1024;

const u16 = (b: Uint8Array, i: number): number => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u32 = (b: Uint8Array, i: number): number => (u16(b, i) | (u16(b, i + 2) << 16)) >>> 0;

/** The end of central directory record: searched backwards past a comment of up to 64 KiB */
const endeFinden = (b: Uint8Array): number => {
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--)
    if (u32(b, i) === EOCD) return i;
  return -1;
};

const nameVon = (b: Uint8Array, flags: number): string =>
  // bit 11: the name is UTF-8 (APPNOTE 4.4.4), else code page 437, which agrees for ASCII names
  new TextDecoder(flags & 0x800 ? "utf-8" : "windows-1252").decode(b);

/** One central directory record at `i`, or null when it is not one Soll reads */
const eintragBei = (b: Uint8Array, i: number): (ZipEintrag & { weiter: number }) | null => {
  if (i + 46 > b.length || u32(b, i) !== ZENTRAL) return null;
  const flags = u16(b, i + 8);
  const laenge = u32(b, i + 20);
  const offset = u32(b, i + 42);
  const n = u16(b, i + 28);
  if (flags & 1 || laenge === 0xffffffff || offset === 0xffffffff || i + 46 + n > b.length)
    return null;
  // the data starts after the local header, whose name and extra field may differ in length
  if (offset + 30 > b.length || u32(b, offset) !== LOKAL) return null;
  const start = offset + 30 + u16(b, offset + 26) + u16(b, offset + 28);
  if (start + laenge > b.length) return null;
  return {
    name: nameVon(b.subarray(i + 46, i + 46 + n), flags),
    methode: u16(b, i + 10),
    start,
    laenge,
    weiter: i + 46 + n + u16(b, i + 30) + u16(b, i + 32),
  };
};

/** The entries of a ZIP by name, or null when it is none or one Soll does not read */
export const zipEintraege = (b: Uint8Array): Map<string, ZipEintrag> | null => {
  const ende = endeFinden(b);
  if (ende < 0) return null;
  const anzahl = u16(b, ende + 10);
  if (anzahl > MAX_EINTRAEGE) return null;
  const eintraege = new Map<string, ZipEintrag>();
  let i = u32(b, ende + 16);
  for (let k = 0; k < anzahl; k++) {
    const eintrag = eintragBei(b, i);
    if (!eintrag) return null;
    const { weiter, ...rest } = eintrag;
    eintraege.set(rest.name, rest);
    i = weiter;
  }
  return eintraege;
};

const ZU_GROSS = Symbol("zu gross");

const verbinden = (teile: readonly Uint8Array[], laenge: number): Uint8Array => {
  const ganz = new Uint8Array(laenge);
  let i = 0;
  for (const teil of teile) {
    ganz.set(teil, i);
    i += teil.length;
  }
  return ganz;
};

/** Inflates raw deflate data, or null when it is broken or would pass the budget */
const inflatieren = (daten: Uint8Array, budget: Budget): Uint8Array | null => {
  const teile: Uint8Array[] = [];
  let laenge = 0;
  const strom = new Inflate((teil) => {
    laenge += teil.length;
    if (laenge > budget.rest) throw ZU_GROSS;
    teile.push(teil);
  });
  try {
    for (let i = 0; i < daten.length; i += STUECK)
      strom.push(daten.subarray(i, i + STUECK), i + STUECK >= daten.length);
    if (daten.length === 0) strom.push(new Uint8Array(0), true);
  } catch {
    return null;
  }
  budget.rest -= laenge;
  return verbinden(teile, laenge);
};

/** The bytes of an entry, or null when its method is unknown, its data broken or too large */
export const entpacken = (
  b: Uint8Array,
  eintrag: ZipEintrag,
  budget: Budget,
): Uint8Array | null => {
  const daten = b.subarray(eintrag.start, eintrag.start + eintrag.laenge);
  if (eintrag.methode === 8) return inflatieren(daten, budget);
  if (eintrag.methode !== 0 || daten.length > budget.rest) return null;
  budget.rest -= daten.length;
  return daten;
};

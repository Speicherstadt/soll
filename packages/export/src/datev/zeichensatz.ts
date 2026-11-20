/*
 * The DATEV ASCII import reads ANSI text, i.e. Windows-1252, with CR LF at the end of each record
 * (open-source exporters that write the format: JeffreyL26/admin, apps/backend/src/modules/
 * compensation/payrollExport/lodas.ts, "Zeichensatz Windows-1252, Satzende CR/LF"; replikativ/kontor,
 * payroll_de_datev/emit.clj, "CR/LF — LF-only is rejected"; docs/datev.md, "Quellen"). The table of
 * 0x80–0x9F is the one of the WHATWG Encoding Standard (index-windows-1252).
 */

/** The characters Windows-1252 puts at 0x80–0x9F instead of the C1 controls */
const OBEN: Readonly<Record<string, number>> = {
  "€": 0x80,
  "‚": 0x82,
  ƒ: 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  ˆ: 0x88,
  "‰": 0x89,
  Š: 0x8a,
  "‹": 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  š: 0x9a,
  "›": 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

const byteVon = (zeichen: string): number | undefined => {
  const code = zeichen.codePointAt(0) ?? 0;
  return code < 0x80 || (code >= 0xa0 && code <= 0xff) ? code : OBEN[zeichen];
};

/**
 * The bytes of a text in Windows-1252. A character outside it is refused rather than replaced: a
 * file for payroll must say what Soll means or nothing.
 */
export const windows1252 = (text: string): Uint8Array<ArrayBuffer> => {
  const bytes: number[] = [];
  for (const zeichen of text) {
    const byte = byteVon(zeichen);
    if (byte === undefined)
      throw new Error(`windows1252: U+${zeichen.codePointAt(0)?.toString(16)}`);
    bytes.push(byte);
  }
  return Uint8Array.from(bytes);
};

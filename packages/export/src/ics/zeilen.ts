/*
 * The content lines of iCalendar, after RFC 5545 (https://www.rfc-editor.org/rfc/rfc5545):
 * Section 3.1 (CRLF, folding at 75 octets), 3.3.5 (DATE-TIME in UTC) and 3.3.11 (TEXT).
 */

/** RFC 5545, 3.1: lines SHOULD NOT be longer than 75 octets, excluding the line break */
const HOECHSTENS = 75;
export const ZEILENENDE = "\r\n";

const kodierer = new TextEncoder();
const oktette = (zeichen: string) => kodierer.encode(zeichen).length;

/**
 * A TEXT value (3.3.11): backslash, semicolon and comma escaped with a backslash, a line break as
 * `\n`; a colon stays. Control characters other than HTAB are not allowed in TEXT and are dropped.
 */
export const textWert = (wert: string): string =>
  wert
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: TEXT forbids these controls (3.3.11)
    .replace(/[\u0000-\u0008\u000a-\u001f\u007f]/g, "");

const zwei = (zahl: number) => String(zahl).padStart(2, "0");

/** A DATE-TIME in UTC (3.3.5, form #2), whole seconds: 20261123T130000Z */
export const utcZeit = (ms: number): string => {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${zwei(d.getUTCMonth() + 1)}${zwei(d.getUTCDate())}` +
    `T${zwei(d.getUTCHours())}${zwei(d.getUTCMinutes())}${zwei(d.getUTCSeconds())}Z`
  );
};

/** A content line without parameters: `NAME:value` (3.1, `contentline`) */
export const inhaltszeile = (name: string, wert: string): string => `${name}:${wert}`;

/**
 * Folds a content line (3.1): CRLF and one space before every part after the first, no part longer
 * than 75 octets; split between characters, never inside a UTF-8 sequence (the note in 3.1), so
 * each part decodes on its own. The space of a continuation counts towards its 75 octets.
 */
export const falten = (zeile: string): string => {
  const teile: string[] = [];
  let teil = "";
  let laenge = 0;
  for (const zeichen of zeile) {
    const groesse = oktette(zeichen);
    if (laenge + groesse > HOECHSTENS) {
      teile.push(teil);
      teil = " ";
      laenge = 1;
    }
    teil += zeichen;
    laenge += groesse;
  }
  teile.push(teil);
  return teile.join(ZEILENENDE);
};

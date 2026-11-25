import { zipSync } from "fflate";

/*
 * A workbook of one sheet, as small as Excel and LibreOffice open it (ECMA-376 Part 1, the minimal
 * SpreadsheetML package of section 12.2 with a style part): for the template of S-702. Text goes
 * inline (`inlineStr`), days and times are serial numbers with the built-in formats 14 (date) and
 * 20 (`h:mm`). The same rows give the same bytes: no clock, a fixed date in the ZIP.
 */

export type Zelle = { text: string } | { tag: string } | { minuten: number } | { zahl: number };

const NS = "http://schemas.openxmlformats.org";
const KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const maskiert = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const spalte = (index: number): string =>
  index < 26
    ? String.fromCharCode(65 + index)
    : spalte(Math.floor(index / 26) - 1) + spalte(index % 26);

/** The serial number of a day in the 1900 system (one more from 1 March 1900, see excel-zahl.ts) */
const seriellVon = (tag: string): number => {
  const [jahr, monat, t] = tag.split("-").map(Number) as [number, number, number];
  return (Date.UTC(jahr, monat - 1, t) - Date.UTC(1899, 11, 30)) / 86_400_000;
};

/** Minutes as a fraction of a day with 16 places, from integers */
const bruchVon = (minuten: number): string =>
  `0.${((BigInt(minuten) * 10n ** 16n) / 1440n).toString().padStart(16, "0")}`;

const zelleXml = (zelle: Zelle, ort: string): string => {
  if ("text" in zelle)
    return `<c r="${ort}" t="inlineStr"><is><t>${maskiert(zelle.text)}</t></is></c>`;
  if ("tag" in zelle) return `<c r="${ort}" s="1"><v>${seriellVon(zelle.tag)}</v></c>`;
  if ("minuten" in zelle) return `<c r="${ort}" s="2"><v>${bruchVon(zelle.minuten)}</v></c>`;
  return `<c r="${ort}"><v>${zelle.zahl}</v></c>`;
};

const blatt = (zeilen: readonly (readonly Zelle[])[]): string =>
  `${KOPF}<worksheet xmlns="${NS}/spreadsheetml/2006/main"><sheetData>${zeilen
    .map(
      (zeile, z) =>
        `<row r="${z + 1}">${zeile.map((zelle, s) => zelleXml(zelle, `${spalte(s)}${z + 1}`)).join("")}</row>`,
    )
    .join("")}</sheetData></worksheet>`;

const STILE = `${KOPF}<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="20" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const TYPEN = `${KOPF}<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const BEZIEHUNG = `${NS}/officeDocument/2006/relationships`;

const PAKET = `${KOPF}<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${BEZIEHUNG}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const MAPPE_BEZIEHUNGEN = `${KOPF}<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${BEZIEHUNG}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${BEZIEHUNG}/styles" Target="styles.xml"/></Relationships>`;

const mappe = (name: string): string =>
  `${KOPF}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${BEZIEHUNG}"><sheets><sheet name="${maskiert(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

/** A fixed date for every entry, from local fields so no time zone changes the bytes */
const DATUM = new Date(2026, 0, 1, 0, 0, 0);

/** The bytes of a workbook with one sheet of these rows */
export const xlsxSchreiben = (name: string, zeilen: readonly (readonly Zelle[])[]): Uint8Array => {
  const utf8 = (text: string) => new TextEncoder().encode(text);
  return zipSync(
    {
      "[Content_Types].xml": utf8(TYPEN),
      "_rels/.rels": utf8(PAKET),
      "xl/workbook.xml": utf8(mappe(name)),
      "xl/_rels/workbook.xml.rels": utf8(MAPPE_BEZIEHUNGEN),
      "xl/styles.xml": utf8(STILE),
      "xl/worksheets/sheet1.xml": utf8(blatt(zeilen)),
    },
    { level: 6, mtime: DATUM },
  );
};

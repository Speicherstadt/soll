import { type Zippable, zipSync } from "fflate";

/* Workbooks for the tests of the Excel reader (S-702), built part by part */

const utf8 = (text: string) => new TextEncoder().encode(text);

const MAPPE =
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Erstes" sheetId="7" r:id="rId3"/><sheet name="Zweites" sheetId="1" r:id="rId1"/></sheets></workbook>';

const BEZIEHUNGEN =
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId3" Type="x/worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>';

/** Styles: 0 general, 1 a German date (custom 164), 2 time `h:mm` (20), 3 `[h]:mm` (custom 165) */
const STILE =
  '<styleSheet><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="[h]:mm"/></numFmts><cellStyleXfs count="1"><xf numFmtId="22"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="20"/><xf numFmtId="165"/></cellXfs></styleSheet>';

export const blattXml = (zeilen: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${zeilen}</sheetData></worksheet>`;

/**
 * A workbook whose first sheet (by the order in `workbook.xml`, not its number) is `sheet2.xml`;
 * `teile` replaces or adds parts
 */
export const mappe = (
  erstesBlatt: string,
  texte: readonly string[] = [],
  teile: Zippable = {},
): Uint8Array =>
  zipSync({
    "xl/workbook.xml": utf8(MAPPE),
    "xl/_rels/workbook.xml.rels": utf8(BEZIEHUNGEN),
    "xl/styles.xml": utf8(STILE),
    "xl/sharedStrings.xml": utf8(
      `<sst>${texte.map((t) => `<si><t xml:space="preserve">${t}</t></si>`).join("")}</sst>`,
    ),
    "xl/worksheets/sheet1.xml": utf8(
      blattXml('<row r="1"><c t="inlineStr"><is><t>falsch</t></is></c></row>'),
    ),
    "xl/worksheets/sheet2.xml": utf8(erstesBlatt),
    ...teile,
  });

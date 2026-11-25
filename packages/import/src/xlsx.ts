import type { CsvZeile } from "./csv.ts";
import { formatArt, type Zahlformat } from "./excel-zahl.ts";
import { xlsxBlatt } from "./xlsx-blatt.ts";
import { textAus, xmlDurchlaufen } from "./xml.ts";
import { type Budget, entpacken, type ZipEintrag, zipEintraege } from "./zip.ts";

/*
 * The first sheet of an Excel workbook (`.xlsx`, ECMA-376 / ISO/IEC 29500, SpreadsheetML) as lines
 * of text cells, like the lines of a CSV (BAULISTE.md S-702). The workbook names its sheets in
 * order (`xl/workbook.xml`), its relationships say which part each is; shared strings and the
 * formats of dates come from their own parts. Everything is read within one budget of inflated
 * bytes, so no file grows past it however it is packed.
 */

/** Inflated bytes all parts of one workbook may make together: 50 MiB */
export const MAX_ENTPACKT = 50 * 1024 * 1024;

export type Mappe = { zeilen: CsvZeile[]; zuViele: boolean } | { fehler: "unlesbar" };

/** The ZIP, its entries and the budget left; `kaputt` once a part could not be inflated */
type Teile = {
  b: Uint8Array;
  eintraege: Map<string, ZipEintrag>;
  budget: Budget;
  kaputt: boolean;
};

const UNLESBAR = { fehler: "unlesbar" } as const;

/**
 * The text of a part by its path, case ignored as Excel does; null when missing, and when it cannot
 * be inflated (broken, or past the budget), which marks the whole workbook as unreadable
 */
const teil = (t: Teile, pfad: string): string | null => {
  const gesucht = pfad.replace(/^\//, "").toLowerCase();
  const eintrag = [...t.eintraege.values()].find((e) => e.name.toLowerCase() === gesucht);
  if (!eintrag) return null;
  const bytes = entpacken(t.b, eintrag, t.budget);
  if (bytes === null) t.kaputt = true;
  return bytes ? new TextDecoder("utf-8").decode(bytes) : null;
};

/** The relationship id of the first sheet and whether the workbook counts days from 1904 */
const mappeLesen = (xml: string) => {
  let id: string | null = null;
  let system1904 = false;
  const ok = xmlDurchlaufen(xml, {
    start: (name, m) => {
      if (name === "sheet" && id === null)
        id = Object.entries(m).find(([k]) => k.endsWith(":id"))?.[1] ?? null;
      if (name === "workbookPr") system1904 = m.date1904 === "1" || m.date1904 === "true";
    },
  });
  return ok ? { id: id as string | null, system1904 } : null;
};

/** The targets of a workbook's relationships by id, as paths in the ZIP */
const beziehungen = (xml: string | null): Map<string, string> => {
  const ziele = new Map<string, string>();
  if (xml === null) return ziele;
  xmlDurchlaufen(xml, {
    start: (name, m) => {
      if (name !== "Relationship" || !m.Id || !m.Target) return;
      ziele.set(m.Id, m.Target.startsWith("/") ? m.Target.slice(1) : `xl/${m.Target}`);
    },
  });
  return ziele;
};

/** The shared strings in order; rich text runs joined, phonetic hints (`rPh`) left out */
const geteilteTexte = (xml: string | null): string[] | null => {
  const texte: string[] = [];
  if (xml === null) return texte;
  let aktuell: string | null = null;
  let imText = false;
  let phonetisch = 0;
  const ok = xmlDurchlaufen(xml, {
    start: (name) => {
      if (name === "si") aktuell = "";
      else if (name === "rPh") phonetisch++;
      else if (name === "t") imText = phonetisch === 0;
    },
    ende: (name) => {
      if (name === "si" && aktuell !== null) texte.push(aktuell);
      if (name === "si") aktuell = null;
      else if (name === "rPh") phonetisch--;
      else if (name === "t") imText = false;
    },
    text: (roh) => {
      if (imText && aktuell !== null) aktuell += textAus(roh);
    },
  });
  return ok ? texte : null;
};

/** The kind of number format of each cell style (`cellXfs`), by the style's index */
const formate = (xml: string | null): Zahlformat[] => {
  if (xml === null) return [];
  const codes = new Map<number, string>();
  const stile: Zahlformat[] = [];
  let inZellstilen = false;
  xmlDurchlaufen(xml, {
    start: (name, m) => {
      if (name === "numFmt") codes.set(Number(m.numFmtId), m.formatCode ?? "");
      else if (name === "cellXfs") inZellstilen = true;
      else if (name === "xf" && inZellstilen) {
        const id = Number(m.numFmtId ?? "0");
        stile.push(formatArt(id, codes.get(id)));
      }
    },
    ende: (name) => {
      if (name === "cellXfs") inZellstilen = false;
    },
  });
  return stile;
};

/** Reads the first sheet of a workbook; `maxZeilen` lines at most, more set `zuViele` */
export const xlsxLesen = (b: Uint8Array, maxZeilen: number, budget = MAX_ENTPACKT): Mappe => {
  const eintraege = zipEintraege(b);
  if (!eintraege) return UNLESBAR;
  const t: Teile = { b, eintraege, budget: { rest: budget }, kaputt: false };
  const mappe = mappeLesen(teil(t, "xl/workbook.xml") ?? "");
  if (!mappe) return UNLESBAR;
  const ziele = beziehungen(teil(t, "xl/_rels/workbook.xml.rels"));
  const pfad = (mappe.id && ziele.get(mappe.id)) || "xl/worksheets/sheet1.xml";
  const texte = geteilteTexte(teil(t, "xl/sharedStrings.xml"));
  const blatt = teil(t, pfad);
  if (texte === null || blatt === null) return UNLESBAR;
  const stile = formate(teil(t, "xl/styles.xml"));
  if (t.kaputt) return UNLESBAR;
  return xlsxBlatt(blatt, { texte, stile, system1904: mappe.system1904, maxZeilen }) ?? UNLESBAR;
};

/** Whether bytes are a ZIP (and so may be a workbook): they start with `PK\x03\x04` */
export const istZip = (b: Uint8Array): boolean =>
  b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

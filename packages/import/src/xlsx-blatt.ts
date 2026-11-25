import type { CsvZeile } from "./csv.ts";
import { type Zahlformat, zellText } from "./excel-zahl.ts";
import { type Merkmale, textAus, xmlDurchlaufen } from "./xml.ts";

/*
 * The cells of one worksheet (ECMA-376 Part 1, 18.3.1.4 `c`, 18.18.11 cell types) as lines of text:
 * shared strings by index, inline strings, formula results as stored, numbers in a date or time
 * format as `YYYY-MM-DD` and `H:MM:SS`, other numbers as written. A cell names its place (`B7`);
 * without one it follows the cell before. Columns from the 201st on are left out, as no header of
 * an import may be longer (S-701); empty lines are no lines.
 */

/** The most columns read, as in the header of a CSV (soll-csv.ts) */
export const MAX_SPALTEN_BLATT = 200;

export type BlattKontext = {
  texte: readonly string[];
  stile: readonly Zahlformat[];
  system1904: boolean;
  maxZeilen: number;
};

type Zelle = { spalte: number; typ: string; stil: number; wert: string; inline: string };

type Stand = {
  zeilen: CsvZeile[];
  zeile: { nummer: number; felder: string[] } | null;
  zelle: Zelle | null;
  /** inside `v` (the value) or `t` of an inline string (`is`) */
  in: "v" | "t" | null;
  letzteZeile: number;
  zuViele: boolean;
};

/** `B7` as column 1 (from 0) and line 7; either may be missing */
export const ortAus = (r: string | undefined): { spalte?: number; zeile?: number } => {
  const teile = /^([A-Z]{1,3})?(\d{1,7})?$/.exec(r ?? "");
  if (!teile || r === "") return {};
  const spalte = teile[1]
    ? [...teile[1]].reduce((n, z) => n * 26 + z.charCodeAt(0) - 64, 0) - 1
    : undefined;
  return {
    ...(spalte === undefined ? {} : { spalte }),
    ...(teile[2] ? { zeile: Number(teile[2]) } : {}),
  };
};

const zellwert = (zelle: Zelle, k: BlattKontext): string => {
  // a shared string without its index is empty, not the first string (Number("") is 0)
  if (zelle.typ === "s")
    return /^\d+$/.test(zelle.wert.trim()) ? (k.texte[Number(zelle.wert)] ?? "") : "";
  if (zelle.typ === "inlineStr") return zelle.inline;
  if (zelle.typ !== "n") return zelle.wert;
  return zellText(zelle.wert.trim(), k.stile[zelle.stil] ?? "zahl", k.system1904);
};

const zeileBeginnen = (s: Stand, m: Merkmale) => {
  const nummer = ortAus(m.r).zeile ?? s.letzteZeile + 1;
  s.letzteZeile = nummer;
  s.zeile = { nummer, felder: [] };
};

/** Keeps a line with a value; past `maxZeilen` such lines only notes that there are more */
const zeileAbschliessen = (s: Stand, k: BlattKontext) => {
  const zeile = s.zeile;
  s.zeile = null;
  if (!zeile?.felder.some((feld) => feld !== "")) return;
  if (s.zeilen.length >= k.maxZeilen) s.zuViele = true;
  else s.zeilen.push({ zeile: zeile.nummer, felder: Array.from(zeile.felder, (f) => f ?? "") });
};

const zelleBeginnen = (s: Stand, m: Merkmale) => {
  if (s.zeile === null) return;
  const spalte = ortAus(m.r).spalte ?? s.zeile.felder.length;
  s.zelle = { spalte, typ: m.t ?? "n", stil: Number(m.s ?? "0"), wert: "", inline: "" };
};

const zelleAbschliessen = (s: Stand, k: BlattKontext) => {
  const zelle = s.zelle;
  s.zelle = null;
  if (!zelle || !s.zeile || zelle.spalte >= MAX_SPALTEN_BLATT) return;
  s.zeile.felder[zelle.spalte] = zellwert(zelle, k);
};

/** The lines of a sheet's XML, or null when it is not readable */
export const xlsxBlatt = (
  xml: string,
  k: BlattKontext,
): { zeilen: CsvZeile[]; zuViele: boolean } | null => {
  const s: Stand = {
    zeilen: [],
    zeile: null,
    zelle: null,
    in: null,
    letzteZeile: 0,
    zuViele: false,
  };
  const ok = xmlDurchlaufen(xml, {
    start: (name, m) => {
      if (name === "row") zeileBeginnen(s, m);
      else if (name === "c") zelleBeginnen(s, m);
      else if (name === "v" || name === "t") s.in = s.zelle ? name : null;
    },
    ende: (name) => {
      if (name === "row") zeileAbschliessen(s, k);
      else if (name === "c") zelleAbschliessen(s, k);
      else if (name === "v" || name === "t") s.in = null;
    },
    text: (roh) => {
      if (s.zelle && s.in === "v") s.zelle.wert += textAus(roh);
      else if (s.zelle && s.in === "t") s.zelle.inline += textAus(roh);
    },
  });
  return ok ? { zeilen: s.zeilen, zuViele: s.zuViele } : null;
};

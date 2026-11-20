import { type CsvZeile, csvZeilen, trennzeichenVon } from "./csv.ts";

/**
 * A list of employees from a spreadsheet, for the setup (BAULISTE.md S-303): one person per line with
 * a name (or first and last name) and an optional role. What it reads becomes invitations by link, so
 * a person needs nothing but a name; the server checks the list again (Zod) before it invites anyone.
 */

/** The roles a file may name; a device is set up by the owner at the terminal, not imported */
export const CSV_ROLLEN = [
  "inhaber",
  "planer",
  "mitarbeiter",
  "lohnbuero",
  "betriebsrat",
  "extern",
] as const;
export type CsvRolle = (typeof CSV_ROLLEN)[number];

export type CsvPerson = { zeile: number; name: string; rolle: CsvRolle };
export type CsvFehler =
  | { zeile: number; grund: "kein_kopf" | "zu_viele" | "unlesbar" | "name_fehlt" | "name_zu_lang" }
  | { zeile: number; grund: "rolle_unbekannt"; wert: string };
export type CsvErgebnis = { personen: CsvPerson[]; fehler: CsvFehler[] };

/** As many as one setup invites at once; the server takes no more either */
export const MAX_PERSONEN = 200;
/** The longest name of an invitation (apps/server, routes/einladungen.ts) */
const MAX_NAME = 100;

/** Lower case without accents and inner spaces, so "Lohnbüro", "lohnbuero" and "LOHN BÜRO" match */
const schluessel = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const SPALTEN: Record<string, "name" | "vorname" | "nachname" | "rolle"> = {
  name: "name",
  vollername: "name",
  fullname: "name",
  vorname: "vorname",
  firstname: "vorname",
  givenname: "vorname",
  nachname: "nachname",
  familienname: "nachname",
  lastname: "nachname",
  surname: "nachname",
  rolle: "rolle",
  role: "rolle",
};

const ROLLEN: Record<string, CsvRolle> = {
  ...Object.fromEntries(CSV_ROLLEN.map((rolle) => [rolle, rolle])),
  inhaberin: "inhaber",
  owner: "inhaber",
  planerin: "planer",
  planner: "planer",
  mitarbeiterin: "mitarbeiter",
  employee: "mitarbeiter",
  lohnbuero: "lohnbuero",
  lohnburo: "lohnbuero",
  payroll: "lohnbuero",
  betriebsraetin: "betriebsrat",
  betriebsratin: "betriebsrat",
  workscouncil: "betriebsrat",
  externe: "extern",
  externer: "extern",
  external: "extern",
};

type Kopf = Partial<Record<"name" | "vorname" | "nachname" | "rolle", number>>;

const kopfAus = (felder: string[]): Kopf | null => {
  const kopf: Kopf = {};
  felder.forEach((feld, index) => {
    const spalte = SPALTEN[schluessel(feld)];
    if (spalte && kopf[spalte] === undefined) kopf[spalte] = index;
  });
  return kopf.name !== undefined || kopf.vorname !== undefined || kopf.nachname !== undefined
    ? kopf
    : null;
};

const feld = (zeile: CsvZeile, index: number | undefined): string =>
  (index === undefined ? "" : (zeile.felder[index] ?? "")).replace(/\s+/g, " ").trim();

const personAus = (zeile: CsvZeile, kopf: Kopf): CsvPerson | CsvFehler => {
  // a quote never closed swallows the lines after it: no name read from them could be trusted
  if (zeile.offen) return { zeile: zeile.zeile, grund: "unlesbar" };
  const name =
    feld(zeile, kopf.name) ||
    [feld(zeile, kopf.vorname), feld(zeile, kopf.nachname)].filter(Boolean).join(" ");
  if (!name) return { zeile: zeile.zeile, grund: "name_fehlt" };
  if (name.length > MAX_NAME) return { zeile: zeile.zeile, grund: "name_zu_lang" };
  const wert = feld(zeile, kopf.rolle);
  const rolle = wert ? ROLLEN[schluessel(wert)] : "mitarbeiter";
  if (!rolle) return { zeile: zeile.zeile, grund: "rolle_unbekannt", wert };
  return { zeile: zeile.zeile, name, rolle };
};

export const mitarbeiterAusCsv = (text: string): CsvErgebnis => {
  const ohneBom = text.replace(/^﻿/, "");
  const [kopfZeile, ...zeilen] = csvZeilen(ohneBom, trennzeichenVon(ohneBom));
  const kopf = kopfZeile && kopfAus(kopfZeile.felder);
  if (kopfZeile?.offen) return { personen: [], fehler: [{ zeile: 1, grund: "unlesbar" }] };
  if (!kopf) return { personen: [], fehler: [{ zeile: 1, grund: "kein_kopf" }] };
  if (zeilen.length > MAX_PERSONEN) {
    const zuViel = zeilen[MAX_PERSONEN] as CsvZeile;
    return { personen: [], fehler: [{ zeile: zuViel.zeile, grund: "zu_viele" }] };
  }
  const ergebnisse = zeilen.map((zeile) => personAus(zeile, kopf));
  return {
    personen: ergebnisse.filter((e): e is CsvPerson => "name" in e),
    fehler: ergebnisse.filter((e): e is CsvFehler => "grund" in e),
  };
};

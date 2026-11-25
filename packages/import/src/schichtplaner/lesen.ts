import { istTag } from "@soll/arbeitszeit";
import { kurzerText, objekt } from "../abzug-gemeinsam.ts";
import { zeitpunktLesen } from "../kimai/werte.ts";
import type { LeseFehler } from "../modell.ts";
import { SCHICHTPLANER_FORMAT, SCHICHTPLANER_VERSION } from "./abzug.ts";

/*
 * Reads the file of a fetch from a shift planner (abzug.ts, BAULISTE.md S-706) line by line. A line
 * that is no flat JSON object, names no known kind or holds a field of the wrong type is refused
 * with its line; nothing a file holds makes the reader throw (fuzzed).
 */

type Satz = Record<string, unknown>;
type Fehler = Omit<LeseFehler, "zeile">;

export type Person = { zeile: number; id: string; name: string };
export type Schicht = {
  zeile: number;
  id: string;
  person: string | null;
  beginn: number;
  ende: number;
  pause: number;
  rolle: string;
};
/** A piece of work; `ende` null while it runs */
export type Arbeit = {
  zeile: number;
  id: string;
  person: string;
  beginn: number;
  ende: number | null;
};
export type Abwesenheit = {
  zeile: number;
  id: string;
  person: string;
  art: string;
  von: string;
  bis: string;
  ersterHalb: boolean;
  letzterHalb: boolean;
  genehmigt: boolean;
  teilTag: boolean;
};

export type Bestand = {
  werkzeug: string;
  von: string;
  bis: string;
  personen: Person[];
  schichten: Schicht[];
  arbeit: Arbeit[];
  abwesenheiten: Abwesenheit[];
  fehler: LeseFehler[];
};

/** An id of the tools (whole numbers; a piece of a record "<id>/<n>") */
const kennung = (wert: unknown): string | null => {
  if (typeof wert === "number" && Number.isSafeInteger(wert) && wert >= 0) return String(wert);
  return typeof wert === "string" && /^[A-Za-z0-9_./-]{1,64}$/.test(wert) ? wert : null;
};

/** The minutes of a planned break: a whole number of at most a day */
const minuten = (wert: unknown): number | null =>
  typeof wert === "number" && Number.isSafeInteger(wert) && wert >= 0 && wert <= 1440 ? wert : null;

const person = (s: Satz): Omit<Person, "zeile"> | Fehler => {
  const id = kennung(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const name = kurzerText(s.name);
  if (name === null && typeof s.name === "string") return { grund: "zu_lang", feld: "name" };
  return name ? { id, name } : { grund: "name_fehlt", feld: "name" };
};

type Teil = { id: string; person: string | null; beginn: number; ende: number | null };

/** Id, person and the two instants of a shift (`offen`: perhaps nobody's) or a piece of work */
const spanne = (s: Satz, offen: boolean): Teil | Fehler => {
  const id = kennung(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const wer = s.person === null && offen ? null : kennung(s.person);
  if (wer === null && (!offen || s.person !== null))
    return { grund: "person_fehlt", feld: "person" };
  const beginn = zeitpunktLesen(s.begin);
  if (beginn === null) return { grund: "zeit_ungueltig", feld: "begin" };
  const ende = s.end === null ? null : zeitpunktLesen(s.end);
  if (ende === null && s.end !== null) return { grund: "zeit_ungueltig", feld: "end" };
  return { id, person: wer, beginn, ende };
};

const schicht = (s: Satz): Omit<Schicht, "zeile"> | Fehler => {
  const teil = spanne(s, true);
  if ("grund" in teil) return teil;
  if (teil.ende === null) return { grund: "zeit_ungueltig", feld: "end" };
  const pause = minuten(s.break);
  if (pause === null) return { grund: "pause_ungueltig", feld: "break" };
  const rolle = kurzerText(s.role ?? "");
  if (rolle === null) return { grund: "zu_lang", feld: "role" };
  return { ...teil, ende: teil.ende, pause, rolle };
};

const arbeit = (s: Satz): Omit<Arbeit, "zeile"> | Fehler => {
  const teil = spanne(s, false);
  return "grund" in teil ? teil : { ...teil, person: teil.person ?? "" };
};

const abwesenheit = (s: Satz): Omit<Abwesenheit, "zeile"> | Fehler => {
  const id = kennung(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const wer = kennung(s.person);
  if (wer === null) return { grund: "person_fehlt", feld: "person" };
  const art = kurzerText(s.type);
  if (!art) return { grund: "art_fehlt", feld: "type" };
  for (const feld of ["from", "to"] as const)
    if (typeof s[feld] !== "string" || !istTag(s[feld] as string))
      return { grund: "datum_ungueltig", feld };
  const flags = ["first_half", "last_half", "approved", "part_day"] as const;
  const falsch = flags.find((feld) => typeof s[feld] !== "boolean");
  if (falsch) return { grund: "unlesbar", feld: falsch };
  return {
    id,
    person: wer,
    art,
    von: s.from as string,
    bis: s.to as string,
    ersterHalb: s.first_half as boolean,
    letzterHalb: s.last_half as boolean,
    genehmigt: s.approved as boolean,
    teilTag: s.part_day as boolean,
  };
};

const LESER = { person, shift: schicht, work: arbeit, absence: abwesenheit } as const;
const ZIEL = { person: "personen", shift: "schichten", work: "arbeit", absence: "abwesenheiten" };

/** One line into the store of its kind, or the reason it cannot be read */
const aufnehmen = (bestand: Bestand, zeile: number, s: Satz): Fehler | null => {
  const art = s.kind;
  if (typeof art !== "string" || !Object.hasOwn(LESER, art))
    return { grund: "typ_unbekannt", feld: "kind" };
  const satz = LESER[art as keyof typeof LESER](s);
  if ("grund" in satz) return satz;
  (bestand[ZIEL[art as keyof typeof ZIEL] as "personen"] as unknown[]).push({ zeile, ...satz });
  return null;
};

/** The head of a file of the tool: its period, or null */
const kopfVon = (zeile: string, werkzeug: string): { von: string; bis: string } | null => {
  const kopf = objekt(zeile);
  if (
    kopf === null ||
    kopf.format !== SCHICHTPLANER_FORMAT ||
    kopf.version !== SCHICHTPLANER_VERSION ||
    kopf.tool !== werkzeug ||
    typeof kopf.from !== "string" ||
    typeof kopf.to !== "string" ||
    !istTag(kopf.from) ||
    !istTag(kopf.to)
  )
    return null;
  return { von: kopf.from, bis: kopf.to };
};

/** The records of the file, or the one reason it is none: no head, or more lines than allowed */
export const abzugLesen = (
  text: string,
  werkzeug: string,
  hoechstens: number,
): { bestand: Bestand } | { fehler: LeseFehler } => {
  const zeilen = text.split("\n");
  const zeitraum = kopfVon(zeilen[0] ?? "", werkzeug);
  if (zeitraum === null) return { fehler: { zeile: 1, grund: "kein_kopf" } };
  const saetze = zeilen.length - 1 - (zeilen.at(-1) === "" ? 1 : 0);
  if (saetze > hoechstens) return { fehler: { zeile: hoechstens + 2, grund: "zu_viele" } };
  const bestand: Bestand = {
    werkzeug,
    ...zeitraum,
    personen: [],
    schichten: [],
    arbeit: [],
    abwesenheiten: [],
    fehler: [],
  };
  zeilen.forEach((zeile, index) => {
    if (index === 0 || zeile.trim() === "") return;
    const satz = objekt(zeile);
    const fehler =
      satz === null ? { grund: "unlesbar" as const } : aufnehmen(bestand, index + 1, satz);
    if (fehler) bestand.fehler.push({ zeile: index + 1, ...fehler });
  });
  return { bestand };
};

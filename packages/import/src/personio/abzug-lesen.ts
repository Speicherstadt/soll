import { kurzerText, objekt } from "../abzug-gemeinsam.ts";
import type { LeseFehler } from "../modell.ts";
import { PERSONIO_FORMAT, PERSONIO_VERSION } from "./abzug.ts";
import {
  type Abwesenheit,
  type Anwesenheit,
  type Art,
  type Bestand,
  type Haelfte,
  leererBestand,
  type Person,
} from "./bestand.ts";
import { ortszeitLesen, personioKennung } from "./werte.ts";

/*
 * Reads the file of a fetch from Personio's API v2 (abzug.ts) line by line. A line that is no JSON
 * object, names no known kind or holds a field of the wrong type is refused with its line; nothing a
 * file holds makes the reader throw (BAULISTE.md S-704, fuzzed).
 */

type Satz = Record<string, unknown>;
type Fehler = Omit<LeseFehler, "zeile">;
type Gelesen<T> = Omit<T, "zeile"> | Fehler;

const leer = (wert: unknown): boolean => wert === null || wert === undefined;

/** A text Personio may leave out: "" when missing, null when not a short text */
const freierText = (wert: unknown): string | null => (leer(wert) ? "" : kurzerText(wert));

/** First and last name as the person of the mapping, else the preferred name */
const person = (s: Satz): Gelesen<Person> => {
  const id = personioKennung(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const felder = ["first_name", "last_name", "preferred_name"] as const;
  const teile = felder.map((feld) => freierText(s[feld]));
  const zuLang = felder.find((_, i) => teile[i] === null);
  if (zuLang) return { grund: "zu_lang", feld: zuLang };
  const [vorname, nachname, rufname] = teile as string[];
  const name = `${vorname} ${nachname}`.trim() || (rufname as string);
  return name ? { id, name } : { grund: "name_fehlt", feld: "first_name" };
};

const art = (s: Satz): Gelesen<Art> => {
  const id = personioKennung(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const name = kurzerText(s.name);
  if (!name)
    return {
      grund: name === null && typeof s.name === "string" ? "zu_lang" : "name_fehlt",
      feld: "name",
    };
  return { id, name, stunden: s.unit === "HOUR" };
};

/** The approval of a period: its status, null when Personio keeps none */
const status = (wert: unknown): string | null | undefined =>
  leer(wert) ? null : typeof wert === "string" && /^[A-Z_]{1,40}$/.test(wert) ? wert : undefined;

const anwesenheit = (s: Satz): Gelesen<Anwesenheit> => {
  const id = personioKennung(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const wer = personioKennung(s["person.id"]);
  if (wer === null) return { grund: "person_fehlt", feld: "person.id" };
  if (s.type !== "WORK" && s.type !== "BREAK") return { grund: "typ_unbekannt", feld: "type" };
  const beginn = ortszeitLesen(s["start.date_time"]);
  if (beginn === null) return { grund: "zeit_ungueltig", feld: "start.date_time" };
  const ende = leer(s["end.date_time"]) ? null : ortszeitLesen(s["end.date_time"]);
  if (ende === null && !leer(s["end.date_time"]))
    return { grund: "zeit_ungueltig", feld: "end.date_time" };
  const freigabe = status(s["approval.status"]);
  if (freigabe === undefined) return { grund: "unlesbar", feld: "approval.status" };
  return { id, person: wer, arbeit: s.type === "WORK", beginn, ende, status: freigabe };
};

/** FIRST_HALF or SECOND_HALF; missing is null; anything else undefined */
const haelfte = (wert: unknown): Haelfte | null | undefined =>
  leer(wert) ? null : wert === "FIRST_HALF" || wert === "SECOND_HALF" ? wert : undefined;

const abwesenheit = (s: Satz): Gelesen<Abwesenheit> => {
  const id = personioKennung(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const wer = personioKennung(s["person.id"]);
  if (wer === null) return { grund: "person_fehlt", feld: "person.id" };
  const welche = personioKennung(s["absence_type.id"]);
  if (welche === null) return { grund: "art_fehlt", feld: "absence_type.id" };
  const beginn = ortszeitLesen(s["starts_from.date_time"]);
  if (beginn === null) return { grund: "datum_ungueltig", feld: "starts_from.date_time" };
  const ende = leer(s["ends_at.date_time"]) ? null : ortszeitLesen(s["ends_at.date_time"]);
  if (ende === null && !leer(s["ends_at.date_time"]))
    return { grund: "datum_ungueltig", feld: "ends_at.date_time" };
  const beginnHalb = haelfte(s["starts_from.type"]);
  if (beginnHalb === undefined) return { grund: "datum_ungueltig", feld: "starts_from.type" };
  const endeHalb = haelfte(s["ends_at.type"]);
  if (endeHalb === undefined) return { grund: "datum_ungueltig", feld: "ends_at.type" };
  const freigabe = status(s["approval.status"]);
  if (freigabe === undefined) return { grund: "unlesbar", feld: "approval.status" };
  return { id, person: wer, art: welche, beginn, beginnHalb, ende, endeHalb, status: freigabe };
};

/** A record into its list, or why it cannot be read */
const aufnehmen = <T>(liste: T[], zeile: number, satz: Gelesen<T>): Fehler | null => {
  if ("grund" in satz) return satz;
  liste.push({ zeile, ...satz } as T);
  return null;
};

const satzAufnehmen = (bestand: Bestand, zeile: number, s: Satz): Fehler | null => {
  switch (s.kind) {
    case "person":
      return aufnehmen(bestand.personen, zeile, person(s));
    case "absence_type":
      return aufnehmen(bestand.arten, zeile, art(s));
    case "attendance":
      return aufnehmen(bestand.anwesenheiten, zeile, anwesenheit(s));
    case "absence":
      return aufnehmen(bestand.abwesenheiten, zeile, abwesenheit(s));
    default:
      return { grund: "typ_unbekannt", feld: "kind" };
  }
};

/** The records of the file, or the one reason it is none: no head, or more lines than allowed */
export const abzugLesen = (
  text: string,
  hoechstens: number,
): { bestand: Bestand; kopf: Satz } | { fehler: LeseFehler } => {
  const zeilen = text.split("\n");
  const kopf = objekt(zeilen[0] ?? "");
  if (kopf === null || kopf.format !== PERSONIO_FORMAT || kopf.version !== PERSONIO_VERSION)
    return { fehler: { zeile: 1, grund: "kein_kopf" } };
  const saetze = zeilen.length - 1 - (zeilen.at(-1) === "" ? 1 : 0);
  if (saetze > hoechstens) return { fehler: { zeile: hoechstens + 2, grund: "zu_viele" } };
  const bestand = leererBestand();
  zeilen.forEach((zeile, index) => {
    if (index === 0 || zeile.trim() === "") return;
    const satz = objekt(zeile);
    const fehler =
      satz === null ? { grund: "unlesbar" as const } : satzAufnehmen(bestand, index + 1, satz);
    if (fehler) bestand.fehler.push({ zeile: index + 1, ...fehler });
  });
  return { bestand, kopf };
};

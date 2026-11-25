import { kennungVon, kurzerText, objekt } from "../abzug-gemeinsam.ts";
import type { LeseFehler } from "../modell.ts";
import { KIMAI_FORMAT, KIMAI_VERSION } from "./abzug.ts";
import { type Benannt, type Bestand, leererBestand, type Zeitbuchung } from "./bestand.ts";
import { sekundenLesen, zeitpunktLesen } from "./werte.ts";

/*
 * Reads the file of a fetch from Kimai's API (abzug.ts) line by line. A line that is no JSON object,
 * names no known kind or holds a field of the wrong type is refused with its line; nothing a file
 * holds makes the reader throw (BAULISTE.md S-705, fuzzed).
 */

type Satz = Record<string, unknown>;
type Fehler = Omit<LeseFehler, "zeile">;

/** Name and number of a customer, project or activity (`number` may be null in Kimai) */
const benannt = (s: Satz): Omit<Benannt, "zeile"> | Fehler => {
  const id = kennungVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const name = kurzerText(s.name);
  if (!name)
    return {
      grund: name === null && typeof s.name === "string" ? "zu_lang" : "name_fehlt",
      feld: "name",
    };
  const nummer = s.number === null || s.number === undefined ? "" : kurzerText(s.number);
  return nummer === null ? { grund: "zu_lang", feld: "number" } : { id, name, nummer };
};

/** A user: the alias Kimai shows, else the user name */
const nutzer = (s: Satz): { id: string; name: string } | Fehler => {
  const id = kennungVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const alias = s.alias === null || s.alias === undefined ? "" : kurzerText(s.alias);
  const name = kurzerText(s.username);
  if (alias === null) return { grund: "zu_lang", feld: "alias" };
  if (!name) return { grund: "name_fehlt", feld: "username" };
  return { id, name: alias || name };
};

const oderNull = (wert: unknown): string | null | undefined =>
  wert === null || wert === undefined ? null : (kennungVon(wert) ?? undefined);

const zeitbuchung = (s: Satz): Omit<Zeitbuchung, "zeile"> | Fehler => {
  const id = kennungVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const nutzerId = kennungVon(s.user);
  if (nutzerId === null) return { grund: "person_fehlt", feld: "user" };
  const beginn = zeitpunktLesen(s.begin);
  if (beginn === null) return { grund: "zeit_ungueltig", feld: "begin" };
  const ende = s.end === null || s.end === undefined ? null : zeitpunktLesen(s.end);
  if (ende === null && s.end !== null && s.end !== undefined)
    return { grund: "zeit_ungueltig", feld: "end" };
  const pauseSekunden = sekundenLesen(s.break);
  if (pauseSekunden === null) return { grund: "pause_ungueltig", feld: "break" };
  const projekt = oderNull(s.project);
  if (projekt === undefined) return { grund: "projekt_unbekannt", feld: "project" };
  const taetigkeit = oderNull(s.activity);
  if (taetigkeit === undefined) return { grund: "taetigkeit_unbekannt", feld: "activity" };
  return { id, nutzer: nutzerId, beginn, ende, pauseSekunden, projekt, taetigkeit };
};

/** One line into the store of its kind, or the reason it cannot be read */
const aufnehmen = (bestand: Bestand, zeile: number, s: Satz): Fehler | null => {
  switch (s.kind) {
    case "timesheet": {
      const satz = zeitbuchung(s);
      if ("grund" in satz) return satz;
      bestand.zeitbuchungen.push({ zeile, ...satz });
      return null;
    }
    case "user": {
      const satz = nutzer(s);
      if ("grund" in satz) return satz;
      bestand.nutzer.push({ zeile, ...satz });
      return null;
    }
    case "customer":
    case "project":
    case "activity":
      return benanntAufnehmen(bestand, zeile, s);
    default:
      return { grund: "typ_unbekannt", feld: "kind" };
  }
};

const benanntAufnehmen = (bestand: Bestand, zeile: number, s: Satz): Fehler | null => {
  const satz = benannt(s);
  if ("grund" in satz) return satz;
  if (s.kind === "customer") bestand.kunden.push({ zeile, ...satz });
  else if (s.kind === "project") {
    const kunde = kennungVon(s.customer);
    if (kunde === null) return { grund: "kunde_unbekannt", feld: "customer" };
    bestand.projekte.push({ zeile, ...satz, kunde });
  } else {
    const projekt = oderNull(s.project);
    if (projekt === undefined) return { grund: "projekt_unbekannt", feld: "project" };
    bestand.taetigkeiten.push({ zeile, ...satz, projekt });
  }
  return null;
};

/** The records of the file, or the one reason it is none: no head, or more lines than allowed */
export const abzugLesen = (
  text: string,
  hoechstens: number,
): { bestand: Bestand } | { fehler: LeseFehler } => {
  const zeilen = text.split("\n");
  const kopf = objekt(zeilen[0] ?? "");
  if (kopf === null || kopf.format !== KIMAI_FORMAT || kopf.version !== KIMAI_VERSION)
    return { fehler: { zeile: 1, grund: "kein_kopf" } };
  const saetze = zeilen.length - 1 - (zeilen.at(-1) === "" ? 1 : 0);
  if (saetze > hoechstens) return { fehler: { zeile: hoechstens + 2, grund: "zu_viele" } };
  const bestand = leererBestand();
  zeilen.forEach((zeile, index) => {
    if (index === 0 || zeile.trim() === "") return;
    const satz = objekt(zeile);
    const fehler =
      satz === null ? { grund: "unlesbar" as const } : aufnehmen(bestand, index + 1, satz);
    if (fehler) bestand.fehler.push({ zeile: index + 1, ...fehler });
  });
  return { bestand };
};

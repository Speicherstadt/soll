import { type Gelesen, type LeseFehler, leer, MAX_DATENSAETZE } from "../modell.ts";
import { ABZUG_FORMAT, ABZUG_VERSION, type AbzugArt } from "./abzug.ts";
import { type Abwesenheit, type Bestand, type Eintrag, leererBestand } from "./bestand.ts";
import { ausBestand } from "./gelesen.ts";
import { kennungVon, kurzerText, zeitpunktLesen } from "./werte.ts";

/*
 * Reads the file of a fetch from Clockodo's API (abzug.ts) line by line. A line that is no JSON
 * object, names no known kind or holds a field of the wrong type is refused with its line; nothing
 * a file holds makes the reader throw (BAULISTE.md S-703, fuzzed).
 */

type Satz = Record<string, unknown>;
type Fehler = Omit<LeseFehler, "zeile">;

/**
 * Whether a line is one flat object: a `{` at its start and no other bracket outside a string. The
 * file holds only flat records (abzug.ts); a line of millions of nested brackets would keep
 * JSON.parse busy for half a second, so it is refused before (BAULISTE.md S-703: no file hangs
 * the reader).
 */
const flach = (zeile: string): boolean => {
  const text = zeile.trim();
  if (!text.startsWith("{")) return false;
  let inText = false;
  for (let i = 1; i < text.length; i++) {
    const zeichen = text[i];
    if (inText) {
      if (zeichen === "\\") i++;
      else if (zeichen === '"') inText = false;
    } else if (zeichen === '"') inText = true;
    else if (zeichen === "{" || zeichen === "[") return false;
  }
  return true;
};

const objekt = (zeile: string): Satz | null => {
  if (!flach(zeile)) return null;
  try {
    const wert: unknown = JSON.parse(zeile);
    return typeof wert === "object" && wert !== null && !Array.isArray(wert)
      ? (wert as Satz)
      : null;
  } catch {
    return null;
  }
};

const ganzOderNull = (wert: unknown): number | null | undefined =>
  wert === null || wert === undefined
    ? null
    : typeof wert === "number" && Number.isFinite(wert)
      ? wert
      : undefined;

const benannt = (s: Satz): { id: string; name: string; nummer: string } | Fehler => {
  const id = kennungVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const name = kurzerText(s.name);
  if (!name) return { grund: name === null ? "zu_lang" : "name_fehlt", feld: "name" };
  const nummer = s.number === null || s.number === undefined ? "" : kurzerText(s.number);
  return nummer === null ? { grund: "zu_lang", feld: "number" } : { id, name, nummer };
};

const eintrag = (s: Satz): Omit<Eintrag, "zeile"> | Fehler => {
  const id = kennungVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const nutzer = kennungVon(s.users_id);
  if (nutzer === null) return { grund: "person_fehlt", feld: "users_id" };
  const typ = ganzOderNull(s.type);
  if (typ === undefined || typ === null) return { grund: "typ_unbekannt", feld: "type" };
  const beginn = typeof s.time_since === "string" ? zeitpunktLesen(s.time_since) : null;
  if (beginn === null) return { grund: "zeit_ungueltig", feld: "time_since" };
  const ende = typeof s.time_until === "string" ? zeitpunktLesen(s.time_until) : null;
  if (ende === null && s.time_until !== null)
    return { grund: "zeit_ungueltig", feld: "time_until" };
  const korrektur = ganzOderNull(s.offset);
  if (korrektur === undefined) return { grund: "korrektur", feld: "offset" };
  return { id, nutzer, typ, beginn, ende, korrektur: korrektur ?? 0 };
};

const abwesenheit = (s: Satz): Omit<Abwesenheit, "zeile"> | Fehler => {
  const id = kennungVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const nutzer = kennungVon(s.users_id);
  if (nutzer === null) return { grund: "person_fehlt", feld: "users_id" };
  const [status, typ, tage, stunden] = [s.status, s.type, s.count_days, s.count_hours].map(
    ganzOderNull,
  );
  if (status === undefined || status === null) return { grund: "art_fehlt", feld: "status" };
  if (typ === undefined || typ === null) return { grund: "art_fehlt", feld: "type" };
  if (tage === undefined || stunden === undefined)
    return { grund: "unlesbar", feld: tage === undefined ? "count_days" : "count_hours" };
  const von = typeof s.date_since === "string" ? s.date_since : "";
  const bis = typeof s.date_until === "string" ? s.date_until : von;
  return { id, nutzer, von, bis, status, typ, tage, stunden };
};

/** One line into the store of its kind, or the reason it cannot be read */
const aufnehmen = (bestand: Bestand, zeile: number, s: Satz): Fehler | null => {
  const art = s.kind as AbzugArt;
  if (art === "entry" || art === "absence") {
    const satz = art === "entry" ? eintrag(s) : abwesenheit(s);
    if ("grund" in satz) return satz;
    if (art === "entry") bestand.eintraege.push({ zeile, ...(satz as Omit<Eintrag, "zeile">) });
    else bestand.abwesenheiten.push({ zeile, ...(satz as Omit<Abwesenheit, "zeile">) });
    return null;
  }
  const liste = { user: "nutzer", customer: "kunden", service: "leistungen", project: "projekte" }[
    art as string
  ] as "nutzer" | "kunden" | "leistungen" | "projekte" | undefined;
  if (liste === undefined) return { grund: "typ_unbekannt", feld: "kind" };
  const satz = benannt(s);
  if ("grund" in satz) return satz;
  if (liste !== "projekte") (bestand[liste] as unknown[]).push({ zeile, ...satz });
  else {
    const kunde = kennungVon(s.customers_id);
    if (kunde === null) return { grund: "kunde_unbekannt", feld: "customers_id" };
    bestand.projekte.push({ zeile, ...satz, kunde });
  }
  return null;
};

/** Whether a text is the file of a fetch: its first line is the head of the format */
export const istAbzug = (text: string): boolean => {
  const ende = text.indexOf("\n");
  const kopf = objekt(ende === -1 ? text : text.slice(0, ende));
  return kopf !== null && kopf.format === ABZUG_FORMAT;
};

const nurFehler = (fehler: LeseFehler): Gelesen => ({
  daten: leer(),
  fehler: [fehler],
  kopf: [],
  spalten: {},
});

export const abzugLesen = (text: string): Gelesen => {
  const zeilen = text.split("\n");
  const kopf = objekt(zeilen[0] ?? "");
  if (kopf === null || kopf.format !== ABZUG_FORMAT || kopf.version !== ABZUG_VERSION)
    return nurFehler({ zeile: 1, grund: "kein_kopf" });
  const saetze = zeilen.length - 1 - (zeilen.at(-1) === "" ? 1 : 0);
  if (saetze > MAX_DATENSAETZE) return nurFehler({ zeile: MAX_DATENSAETZE + 2, grund: "zu_viele" });
  const bestand = leererBestand();
  zeilen.forEach((text, index) => {
    if (index === 0 || text.trim() === "") return;
    const satz = objekt(text);
    const fehler =
      satz === null ? { grund: "unlesbar" as const } : aufnehmen(bestand, index + 1, satz);
    if (fehler) bestand.fehler.push({ zeile: index + 1, ...fehler });
  });
  return ausBestand(bestand, []);
};

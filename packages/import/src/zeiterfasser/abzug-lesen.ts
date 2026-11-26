import { istTag } from "@soll/arbeitszeit";
import { kurzerText, objekt } from "../abzug-gemeinsam.ts";
import { type LeseFehler, MAX_DATENSAETZE, MAX_TEXT } from "../modell.ts";
import { berlinerUhr } from "../uhr.ts";
import { ABZUG_VERSION, CLOCKIFY_FORMAT, TOGGL_FORMAT } from "./abzug.ts";
import type { Eintrag, Stamm } from "./eintraege.ts";
import { zeitpunktLesen } from "./werte.ts";

/*
 * Reads the JSONL file of a fetch from Toggl Track or Clockify (abzug.ts) line by line into the
 * flat entries and master records of eintraege.ts. Every error names its line and reason; no input
 * makes the reader throw (BAULISTE.md S-707, fuzzed).
 */

export type Anbieter = "toggl" | "clockify";

type Satz = Record<string, unknown>;
type Fehler = Omit<LeseFehler, "zeile">;
type ProjektInfo = { kunde: string; name: string };

type Bestand = {
  nutzer: Map<string, string>;
  kunden: Map<string, string>;
  projekte: Map<string, ProjektInfo>;
  aufgaben: Map<string, string>;
  staemme: Stamm[];
  eintraege: Eintrag[];
  fehler: LeseFehler[];
};

const leererBestand = (): Bestand => ({
  nutzer: new Map(),
  kunden: new Map(),
  projekte: new Map(),
  aufgaben: new Map(),
  staemme: [],
  eintraege: [],
  fehler: [],
});

const CLOCKIFY_NEBENARTEN = new Set(["BREAK", "HOLIDAY", "TIME_OFF"]);

const idVon = (wert: unknown): string | null => {
  if (typeof wert === "number" && Number.isSafeInteger(wert) && wert >= 0) return String(wert);
  if (typeof wert === "string") {
    const sauber = wert.trim();
    if (sauber !== "" && sauber.length <= MAX_TEXT) return sauber;
  }
  return null;
};

const nameLesen = (wert: unknown, feld: string): string | Fehler => {
  const name = kurzerText(wert);
  if (!name) {
    return {
      grund: name === null && typeof wert === "string" ? "zu_lang" : "name_fehlt",
      feld,
    };
  }
  return name;
};

const nutzerAufnehmen = (b: Bestand, anbieter: Anbieter, s: Satz): Fehler | null => {
  const id = idVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const feld = anbieter === "toggl" ? "fullname" : "name";
  const name = nameLesen(s[feld], feld);
  if (typeof name !== "string") return name;
  b.nutzer.set(id, name);
  return null;
};

const kundeAufnehmen = (b: Bestand, zeile: number, s: Satz): Fehler | null => {
  const id = idVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const name = nameLesen(s.name, "name");
  if (typeof name !== "string") return name;
  b.kunden.set(id, name);
  b.staemme.push({ zeile, kunde: name, projekt: "" });
  return null;
};

const projektAufnehmen = (
  b: Bestand,
  anbieter: Anbieter,
  zeile: number,
  s: Satz,
): Fehler | null => {
  const id = idVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const name = nameLesen(s.name, "name");
  if (typeof name !== "string") return name;
  const kundenFeld = anbieter === "toggl" ? "client_id" : "clientId";
  const rohKunde = s[kundenFeld];
  let kunde = "";
  if (rohKunde !== null && rohKunde !== undefined && rohKunde !== "") {
    const kundenId = idVon(rohKunde);
    if (kundenId === null) return { grund: "kunde_unbekannt", feld: kundenFeld };
    const kundenName = b.kunden.get(kundenId);
    if (kundenName === undefined) return { grund: "kunde_unbekannt", feld: kundenFeld };
    kunde = kundenName;
  }
  b.projekte.set(id, { kunde, name });
  b.staemme.push({ zeile, kunde, projekt: name });
  return null;
};

const aufgabeAufnehmen = (b: Bestand, s: Satz): Fehler | null => {
  const id = idVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  const name = nameLesen(s.name, "name");
  if (typeof name !== "string") return name;
  b.aufgaben.set(id, name);
  return null;
};

const spanneLesen = (
  anbieter: Anbieter,
  s: Satz,
): { beginn: number; ende: number | null } | Fehler => {
  const beginn = zeitpunktLesen(s.start);
  if (beginn === null) return { grund: "zeit_ungueltig", feld: "start" };
  const endeFeld = anbieter === "toggl" ? "stop" : "end";
  const rohEnde = s[endeFeld];
  if (rohEnde === null || rohEnde === undefined) return { beginn, ende: null };
  const ende = zeitpunktLesen(rohEnde);
  return ende === null ? { grund: "zeit_ungueltig", feld: endeFeld } : { beginn, ende };
};

const eintragAufnehmen = (
  b: Bestand,
  anbieter: Anbieter,
  zeile: number,
  s: Satz,
  zeitraum: { von: string; bis: string } | null,
  uhr: ReturnType<typeof berlinerUhr>,
): Fehler | null => {
  const id = idVon(s.id);
  if (id === null) return { grund: "kennung_fehlt", feld: "id" };
  if (anbieter === "clockify") {
    if (typeof s.type === "string" && CLOCKIFY_NEBENARTEN.has(s.type)) return null;
    if (s.type !== "REGULAR") return { grund: "typ_unbekannt", feld: "type" };
  }
  const nutzerFeld = anbieter === "toggl" ? "user_id" : "userId";
  const nutzerId = idVon(s[nutzerFeld]);
  const person = nutzerId === null ? undefined : b.nutzer.get(nutzerId);
  if (person === undefined) return { grund: "person_fehlt", feld: nutzerFeld };

  const spanne = spanneLesen(anbieter, s);
  if ("grund" in spanne) return spanne;

  const projektFeld = anbieter === "toggl" ? "project_id" : "projectId";
  const rohProjekt = s[projektFeld];
  let kunde = "";
  let projekt = "";
  if (rohProjekt !== null && rohProjekt !== undefined && rohProjekt !== "") {
    const projektId = idVon(rohProjekt);
    const info = projektId === null ? undefined : b.projekte.get(projektId);
    if (info === undefined) return { grund: "projekt_unbekannt", feld: projektFeld };
    kunde = info.kunde;
    projekt = info.name;
  }

  const aufgabeFeld = anbieter === "toggl" ? "task_id" : "taskId";
  const rohAufgabe = s[aufgabeFeld];
  let aufgabe = "";
  if (rohAufgabe !== null && rohAufgabe !== undefined && rohAufgabe !== "") {
    const aufgabeId = idVon(rohAufgabe);
    const name = aufgabeId === null ? undefined : b.aufgaben.get(aufgabeId);
    if (name === undefined) return { grund: "taetigkeit_unbekannt", feld: aufgabeFeld };
    aufgabe = name;
  }

  if (zeitraum !== null) {
    const tag = uhr.uhr(Math.floor(spanne.beginn / 60_000) * 60_000).tag;
    if (tag < zeitraum.von || tag > zeitraum.bis) return null;
  }

  b.eintraege.push({
    zeile,
    person,
    kunde,
    projekt,
    aufgabe,
    beginn: spanne.beginn,
    ende: spanne.ende,
  });
  return null;
};

export const abzugLesen = (
  anbieter: Anbieter,
  text: string,
  hoechstens = MAX_DATENSAETZE,
): { eintraege: Eintrag[]; staemme: Stamm[]; fehler: LeseFehler[] } | { fehler: LeseFehler } => {
  const zeilen = text.split("\n");
  const kopf = objekt(zeilen[0] ?? "");
  const format = anbieter === "toggl" ? TOGGL_FORMAT : CLOCKIFY_FORMAT;
  if (kopf === null || kopf.format !== format || kopf.version !== ABZUG_VERSION)
    return { fehler: { zeile: 1, grund: "kein_kopf" } };
  const saetze = zeilen.length - 1 - (zeilen.at(-1) === "" ? 1 : 0);
  if (saetze > hoechstens) return { fehler: { zeile: hoechstens + 2, grund: "zu_viele" } };

  const zeitraum =
    typeof kopf.von === "string" &&
    typeof kopf.bis === "string" &&
    istTag(kopf.von) &&
    istTag(kopf.bis)
      ? { von: kopf.von, bis: kopf.bis }
      : null;
  const bestand = leererBestand();
  const uhr = berlinerUhr();

  zeilen.forEach((zeile, index) => {
    if (index === 0 || zeile.trim() === "") return;
    const satz = objekt(zeile);
    const nr = index + 1;
    let fehler: Fehler | null = null;
    if (satz === null) fehler = { grund: "unlesbar" };
    else if (satz.kind === "user") fehler = nutzerAufnehmen(bestand, anbieter, satz);
    else if (satz.kind === "client") fehler = kundeAufnehmen(bestand, nr, satz);
    else if (satz.kind === "project") fehler = projektAufnehmen(bestand, anbieter, nr, satz);
    else if (satz.kind === "task") fehler = aufgabeAufnehmen(bestand, satz);
    else if (satz.kind === "time_entry")
      fehler = eintragAufnehmen(bestand, anbieter, nr, satz, zeitraum, uhr);
    else fehler = { grund: "typ_unbekannt", feld: "kind" };

    if (fehler) bestand.fehler.push({ zeile: nr, ...fehler });
  });

  return { eintraege: bestand.eintraege, staemme: bestand.staemme, fehler: bestand.fehler };
};

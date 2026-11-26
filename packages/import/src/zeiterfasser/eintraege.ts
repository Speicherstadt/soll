import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { einmal } from "../abzug-gemeinsam.ts";
import type { ImportBuchung, ImportDaten, LeseFehler } from "../modell.ts";
import { leer } from "../modell.ts";
import { berlinerUhr } from "../uhr.ts";

/*
 * One way for Toggl Track and Clockify (BAULISTE.md S-707): their CSV exports and the files of their
 * APIs become the same flat entries (person, client, project, task, begin, end), and this function
 * makes the records of S-701 of them. Ids do not depend on the way: customers by name, projects by
 * customer and name, activities by name (both tools keep tasks per project, Soll's activities are
 * the business's), bookings by person, begin and end on the minute, so the history of an export
 * and a fetch of the last weeks recognise each other. Times become bookings of project time only,
 * no stamps (docs/plan.md, "Toggl und Clockify: Zeiten als Projektzeit").
 */

const MINUTE = 60_000;
const TAG = 24 * 60 * MINUTE;

/** An entry of a time tracker, its names as written ("" for none), instants in UTC milliseconds */
export type Eintrag = {
  zeile: number;
  person: string;
  kunde: string;
  projekt: string;
  aufgabe: string;
  beginn: number;
  /** null while it runs */
  ende: number | null;
};

/** A client, or a project of a client ("" for none), the tool lists without an entry (its API) */
export type Stamm = { zeile: number; kunde: string; projekt: string };

/** The id of a project in Soll's records: customer and name, unambiguous whatever they hold */
export const projektKennung = (kunde: string, projekt: string): string =>
  JSON.stringify([kunde, projekt]);

/** The id of a booking: the SHA-256 of person, begin and end, not of where it was read */
export const eintragKennung = (person: string, beginn: number, ende: number): string =>
  `eintrag-${bytesToHex(sha256(utf8ToBytes([person, beginn, ende].join("\u0000"))))}`;

type Gefunden = { daten: ImportDaten; fehler: LeseFehler[] };

/** The first line naming each value */
const ersteZeilen = (paare: readonly [string, number][]): Map<string, number> => {
  const zeilen = new Map<string, number>();
  for (const [wert, zeile] of paare) if (!zeilen.has(wert)) zeilen.set(wert, zeile);
  return zeilen;
};

/** A booking of an entry, or why there is none: running, under a minute, a day or longer */
const buchungVon = (
  e: Eintrag,
  uhr: ReturnType<typeof berlinerUhr>,
): (ImportBuchung & { id: string }) | LeseFehler => {
  if (e.ende === null) return { zeile: e.zeile, grund: "laeuft_noch", feld: "ende" };
  // both cut to the minute: entries that follow each other still follow each other (S-602)
  const beginn = Math.floor(e.beginn / MINUTE) * MINUTE;
  const ende = Math.floor(e.ende / MINUTE) * MINUTE;
  if (ende <= beginn || ende - beginn >= TAG)
    return { zeile: e.zeile, grund: "dauer_ungueltig", feld: "ende" };
  const externalId = eintragKennung(e.person, beginn, ende);
  return {
    id: externalId,
    externalId,
    zeile: e.zeile,
    person: e.person,
    tag: uhr.uhr(beginn).tag,
    beginn,
    ende,
    ...(e.projekt === "" ? {} : { projekt: projektKennung(e.kunde, e.projekt) }),
    ...(e.aufgabe === "" ? {} : { taetigkeit: e.aufgabe }),
  };
};

/** The records of the entries and of the clients and projects listed beside them */
export const datenAus = (
  eintraege: readonly Eintrag[],
  staemme: readonly Stamm[],
  fehler: readonly LeseFehler[],
): Gefunden => {
  const alle = [...fehler];
  const uhr = berlinerUhr();
  const buchungen: (ImportBuchung & { id: string })[] = [];
  for (const eintrag of eintraege) {
    const buchung = buchungVon(eintrag, uhr);
    if ("grund" in buchung) alle.push(buchung);
    else buchungen.push(buchung);
  }
  const quellen = [...staemme, ...eintraege].sort((a, b) => a.zeile - b.zeile);
  const kunden = ersteZeilen(quellen.filter((q) => q.kunde !== "").map((q) => [q.kunde, q.zeile]));
  const projekte = ersteZeilen(
    quellen
      .filter((q) => q.projekt !== "")
      .map((q) => [projektKennung(q.kunde, q.projekt), q.zeile]),
  );
  const taetigkeiten = ersteZeilen(
    eintraege.filter((e) => e.aufgabe !== "").map((e) => [e.aufgabe, e.zeile]),
  );
  const daten: ImportDaten = {
    ...leer(),
    kunden: [...kunden].map(([name, zeile]) => ({ externalId: name, zeile, name, nummer: "" })),
    projekte: [...projekte].map(([externalId, zeile]) => {
      const [kunde, name] = JSON.parse(externalId) as [string, string];
      return { externalId, zeile, kunde, name, nummer: "" };
    }),
    taetigkeiten: [...taetigkeiten].map(([name, zeile]) => ({ externalId: name, zeile, name })),
    buchungen: einmal(buchungen, alle).map(({ id: _, ...buchung }) => buchung),
  };
  return { daten, fehler: alle.sort((a, b) => a.zeile - b.zeile) };
};

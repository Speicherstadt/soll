import { PDFDocument } from "pdf-lib";
import {
  A4_QUER,
  druckbar,
  metadaten,
  type Schreiber,
  schreiber,
  schriften,
} from "../pdf/schreiber.ts";
import {
  datumText,
  dauerText,
  monatText,
  tagText,
  zeitpunktText,
} from "../stundenzettel/format.ts";
import {
  aenderungText,
  befundText,
  beginnText,
  endeText,
  erfasstText,
  gegeneintragText,
  monatStand,
} from "./texte.ts";
import type { Pruefexport, PruefPerson, PruefTag } from "./typen.ts";

const SPALTEN = [
  { titel: "Datum", x: 0 },
  { titel: "Beginn", x: 78 },
  { titel: "Ende", x: 120 },
  { titel: "Pausen", x: 190 },
  { titel: "Dauer", x: 232 },
  { titel: "Erfasst am", x: 274 },
  { titel: "Befunde", x: 362 },
] as const;

const zeitraumText = (daten: Pruefexport) => `${datumText(daten.von)} bis ${datumText(daten.bis)}`;

const kopf = (s: Schreiber, daten: Pruefexport, person: PruefPerson) => {
  s.text(`Prüfexport ${zeitraumText(daten)}`, 0, { fett: true, groesse: 14 });
  s.zeile(18);
  s.text(`${person.name} · ${daten.betrieb}`, 0, { groesse: 10 });
  s.zeile(14);
  s.text(
    `Erstellt am ${zeitpunktText(daten.erstelltAm)} · Zeiten in Europe/Berlin, Dauern in Stunden:Minuten`,
    0,
    { grau: true },
  );
  s.zeile(20);
};

const zeileWerte = (tag: PruefTag) => [
  `${tagText(tag.tag)}${tag.tag.slice(0, 4)}`,
  beginnText(tag),
  endeText(tag, true),
  tag.beginn === null ? "" : dauerText(tag.pauseMinuten),
  tag.beginn === null ? "" : dauerText(tag.arbeitsMinuten),
  erfasstText(tag),
];

const BEFUNDE_X = SPALTEN[6].x;

/** One row per day; each finding on a line of its own, so none is cut off (same content as the CSV) */
const tabelle = (s: Schreiber, person: PruefPerson) => {
  for (const spalte of SPALTEN) s.text(spalte.titel, spalte.x, { fett: true });
  s.zeile();
  for (const tag of person.tage) {
    const befunde = tag.befunde.map(befundText);
    s.platz(Math.max(1, befunde.length));
    zeileWerte(tag).forEach((wert, index) => {
      const spalte = SPALTEN[index];
      const naechste = SPALTEN[index + 1];
      if (spalte && naechste) s.text(wert, spalte.x, { breite: naechste.x - spalte.x - 4 });
    });
    befunde.forEach((befund, index) => {
      if (index > 0) s.zeile();
      s.text(befund, BEFUNDE_X);
    });
    s.zeile();
  }
  const summe = person.tage.reduce((minuten, tag) => minuten + tag.arbeitsMinuten, 0);
  s.zeile(4);
  s.text(
    `Summe ${dauerText(summe)} an ${person.tage.length} ${person.tage.length === 1 ? "Tag" : "Tagen"}`,
    0,
    { fett: true },
  );
  s.zeile(20);
};

/** A titled list of lines, each starting with the date of its day */
const abschnitt = (s: Schreiber, titel: string, eintraege: readonly string[]) => {
  if (eintraege.length === 0) return;
  s.platz(2);
  s.text(titel, 0, { fett: true });
  s.zeile();
  for (const eintrag of eintraege) s.absatz(eintrag);
  s.zeile(8);
};

const person = (s: Schreiber, daten: Pruefexport, wer: PruefPerson) => {
  kopf(s, daten, wer);
  tabelle(s, wer);
  abschnitt(
    s,
    "Änderungen von Hand",
    wer.tage.flatMap((tag) =>
      tag.aenderungen.map((a) => `${datumText(tag.tag)}: ${aenderungText(a)}`),
    ),
  );
  abschnitt(
    s,
    "Gegeneinträge zu abgeschlossenen Monaten",
    wer.tage.flatMap((tag) =>
      tag.gegeneintraege.map((g) => `${datumText(tag.tag)}: ${gegeneintragText(g)}`),
    ),
  );
  abschnitt(
    s,
    "Monate und Prüfwerte",
    wer.monate.map((monat) => `${monatText(monat.monat)}: ${monatStand(monat)}`),
  );
  s.absatz(`Einen Prüfwert prüft die Prüfseite: ${daten.pruefseite}`, { grau: true });
};

/** The Prüfexport as a PDF with pdf-lib: A4 landscape, a page of its own for each person */
export const pruefexportPdf = async (daten: Pruefexport): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const schrift = await schriften(doc);
  metadaten(doc, {
    titel: druckbar(schrift.normal, `Prüfexport ${zeitraumText(daten)} · ${daten.betrieb}`),
    betreff: "Arbeitszeiten nach § 16 Abs. 2 ArbZG und § 17 Abs. 1 MiLoG",
    stand: daten.erstelltAm,
  });
  const s = schreiber(doc, schrift, A4_QUER);
  daten.personen.forEach((wer, index) => {
    if (index > 0) s.neueSeite();
    person(s, daten, wer);
  });
  return doc.save();
};

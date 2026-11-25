import type { Striche } from "@soll/arbeitszeit";
import { PDFDocument, rgb } from "pdf-lib";
import {
  druckbar,
  metadaten,
  type Schreiber,
  schreiber,
  schriften,
  type TextOptionen,
  ZEILE,
} from "../pdf/schreiber.ts";
import {
  datumText,
  dauerText,
  tagText,
  uhrzeitText,
  zeitpunktText,
} from "../stundenzettel/format.ts";

/** A booking on the report, frozen when the customer signed: names as they were then */
export type NachweisZeile = {
  tag: string;
  person: string;
  beginn: number;
  ende: number;
  minuten: number;
  taetigkeit: string;
  notiz: string;
};

/**
 * What a signed Stundennachweis shows (S-605); the server freezes it at the signature and keeps it
 * as canonical JSON, whose SHA-256 the PDF prints
 */
export type Stundennachweis = {
  nummer: number;
  betrieb: string;
  kunde: { name: string; nummer: string };
  auftrag: { name: string; nummer: string };
  von: string;
  bis: string;
  zeilen: NachweisZeile[];
  summeMinuten: number;
  bemerkung: string;
  unterschrift: { name: string; am: number; striche: Striche };
};

const SPALTEN = [
  { titel: "Tag", x: 0 },
  { titel: "Person", x: 62 },
  { titel: "Zeit", x: 170 },
  { titel: "Dauer", x: 240 },
  { titel: "Tätigkeit", x: 280 },
  { titel: "Notiz", x: 370 },
] as const;

/** The signature drawn at a third of its surface (600 × 200 → 200 × 66.7 points) */
const MASSSTAB = 1 / 3;
const UNTERSCHRIFT_HOEHE = 200 * MASSSTAB + 8;

const mitNummer = (teil: { name: string; nummer: string }) =>
  [teil.name, teil.nummer].filter(Boolean).join(" · ");

const kopf = (s: Schreiber, nachweis: Stundennachweis) => {
  s.text(`Stundennachweis Nr. ${nachweis.nummer}`, 0, { fett: true, groesse: 14 });
  s.zeile(18);
  s.text(nachweis.betrieb, 0, { groesse: 10 });
  s.zeile(16);
  const angaben = [
    ["Kunde", mitNummer(nachweis.kunde)],
    ["Auftrag", mitNummer(nachweis.auftrag)],
    ["Zeitraum", `${datumText(nachweis.von)} bis ${datumText(nachweis.bis)}`],
  ];
  for (const [titel, wert] of angaben) {
    s.text(titel ?? "", 0, { fett: true });
    s.text(wert ?? "", 62);
    s.zeile();
  }
  s.zeile(8);
};

const spaltenKopf = (s: Schreiber) => {
  for (const spalte of SPALTEN) s.text(spalte.titel, spalte.x, { fett: true });
  s.zeile();
};

/** A new page for the table, which starts with the head of the table again */
const tabellenSeite = (s: Schreiber) => {
  s.neueSeite();
  spaltenKopf(s);
};

type Zelle = { x: number; optionen: TextOptionen; teile: string[] };

/** The lines `ab` to `ab + anzahl` of each cell, the first of them on the current line */
const zeilenZeichnen = (s: Schreiber, zellen: Zelle[], ab: number, anzahl: number) => {
  for (const zelle of zellen)
    zelle.teile.slice(ab, ab + anzahl).forEach((teil, nummer) => {
      s.text(teil, zelle.x, { ...zelle.optionen, unten: nummer * ZEILE });
    });
  s.zeile(anzahl * ZEILE);
};

/**
 * A booking as a row of the table: each cell wraps over as many lines as it needs, so the customer
 * signs every word of activity and note (S-605). The row grows with its tallest cell and stays on
 * one page when it fits on one; a taller row goes on on the next pages, so nothing signed is drawn
 * below the bottom
 */
const reihe = (s: Schreiber, zeile: NachweisZeile) => {
  const werte = [
    tagText(zeile.tag),
    zeile.person,
    `${uhrzeitText(zeile.beginn)}–${uhrzeitText(zeile.ende)}`,
    dauerText(zeile.minuten),
    zeile.taetigkeit,
    zeile.notiz,
  ];
  const zellen: Zelle[] = SPALTEN.map((spalte, index) => {
    const naechste = SPALTEN[index + 1];
    const optionen = naechste ? { breite: naechste.x - spalte.x - 4 } : {};
    return { x: spalte.x, optionen, teile: s.umbrechen(werte[index] ?? "", spalte.x, optionen) };
  });
  const hoehe = Math.max(...zellen.map((zelle) => zelle.teile.length));
  // a new page below the head of the table holds jeSeite - 1 lines
  const ganz = hoehe <= s.jeSeite - 1;
  if ((ganz && hoehe > s.frei()) || s.frei() === 0) tabellenSeite(s);
  let ab = 0;
  while (ab < hoehe) {
    const anzahl = Math.min(hoehe - ab, s.frei());
    zeilenZeichnen(s, zellen, ab, anzahl);
    ab += anzahl;
    if (ab < hoehe) tabellenSeite(s);
  }
};

const tabelle = (s: Schreiber, nachweis: Stundennachweis) => {
  spaltenKopf(s);
  for (const zeile of nachweis.zeilen) reihe(s, zeile);
  s.zeile(4);
  s.platz(1);
  s.text(`Summe ${dauerText(nachweis.summeMinuten)}`, 0, { fett: true });
  s.zeile(18);
};

const bemerkung = (s: Schreiber, nachweis: Stundennachweis) => {
  if (nachweis.bemerkung.trim() === "") return;
  s.platz(2);
  s.text("Bemerkung", 0, { fett: true });
  s.zeile();
  for (const absatz of nachweis.bemerkung.split(/\r?\n/)) s.absatz(absatz);
  s.zeile(8);
};

/** The strokes as one SVG path: a move to each stroke's first point, lines to the others */
const svgPfad = (striche: Striche): string =>
  striche
    .map((strich) => {
      const [erster, ...rest] = strich;
      if (!erster) return "";
      const weiter = rest.length > 0 ? rest : [erster];
      return `M ${erster[0]} ${erster[1]} ${weiter.map(([x, y]) => `L ${x} ${y}`).join(" ")}`;
    })
    .join(" ");

/**
 * The lines the signature block needs: its title, the drawing and the two lines under it, kept on
 * one page so none of them lands in the bottom margin
 */
const UNTERSCHRIFT_ZEILEN = Math.ceil((6 + UNTERSCHRIFT_HOEHE + 4 + 16) / ZEILE) + 1;

const unterschrift = (s: Schreiber, nachweis: Stundennachweis, hash: string) => {
  s.platz(UNTERSCHRIFT_ZEILEN);
  s.text("Unterschrift des Kunden", 0, { fett: true });
  s.zeile(6);
  s.bereich(UNTERSCHRIFT_HOEHE, (seite, x, oben) => {
    seite.drawSvgPath(svgPfad(nachweis.unterschrift.striche), {
      x,
      y: oben,
      scale: MASSSTAB,
      borderColor: rgb(0.04, 0.04, 0.04),
      borderWidth: 4.5,
      borderLineCap: 1,
    });
    seite.drawLine({
      start: { x, y: oben - 200 * MASSSTAB },
      end: { x: x + 600 * MASSSTAB, y: oben - 200 * MASSSTAB },
      thickness: 0.5,
      color: rgb(0.44, 0.44, 0.48),
    });
  });
  s.zeile(4);
  const { name, am } = nachweis.unterschrift;
  const zeit = `am ${zeitpunktText(am)}`;
  const satz = `Unterschrieben von ${name} ${zeit}`;
  // A long name wraps and the time gets a line of its own, so neither is cut off
  if (s.umbrechen(satz).length === 1) s.text(satz, 0);
  else {
    s.absatz(`Unterschrieben von ${name}`);
    s.platz(1);
    s.text(zeit, 0);
  }
  s.zeile(16);
  s.text(`SHA-256 des Inhalts: ${hash}`, 0, { groesse: 7.5, grau: true });
  s.zeile();
};

/**
 * The signed Stundennachweis (Regiebericht) as a PDF with pdf-lib, A4, German like the time sheet
 * (docs/plan.md, "Sprache des Stundenzettels"); fixed metadata, so the same content gives the same
 * file and S-606 can attach it to Haben again and again
 */
export const stundennachweisPdf = async (
  nachweis: Stundennachweis,
  hash: string,
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const schrift = await schriften(doc);
  metadaten(doc, {
    titel: druckbar(
      schrift.normal,
      `Stundennachweis Nr. ${nachweis.nummer} · ${nachweis.kunde.name}`,
    ),
    betreff: hash,
    stand: nachweis.unterschrift.am,
  });
  const s = schreiber(doc, schrift);
  kopf(s, nachweis);
  tabelle(s, nachweis);
  bemerkung(s, nachweis);
  unterschrift(s, nachweis, hash);
  return doc.save();
};

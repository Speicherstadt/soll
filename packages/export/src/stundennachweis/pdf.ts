import type { Striche } from "@soll/arbeitszeit";
import { PDFDocument, rgb } from "pdf-lib";
import { druckbar, metadaten, type Schreiber, schreiber, schriften } from "../pdf/schreiber.ts";
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

const tabelle = (s: Schreiber, nachweis: Stundennachweis) => {
  for (const spalte of SPALTEN) s.text(spalte.titel, spalte.x, { fett: true });
  s.zeile();
  for (const zeile of nachweis.zeilen) {
    s.platz(1);
    const werte = [
      tagText(zeile.tag),
      zeile.person,
      `${uhrzeitText(zeile.beginn)}–${uhrzeitText(zeile.ende)}`,
      dauerText(zeile.minuten),
      zeile.taetigkeit,
      zeile.notiz,
    ];
    werte.forEach((wert, index) => {
      const spalte = SPALTEN[index];
      const naechste = SPALTEN[index + 1];
      if (spalte) s.text(wert, spalte.x, naechste ? { breite: naechste.x - spalte.x - 4 } : {});
    });
    s.zeile();
  }
  s.zeile(4);
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

const unterschrift = (s: Schreiber, nachweis: Stundennachweis, hash: string) => {
  s.platz(3);
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
  s.text(`Unterschrieben von ${name} am ${zeitpunktText(am)}`, 0);
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

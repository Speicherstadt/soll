import { PDFDocument } from "pdf-lib";
import { befundText } from "../befunde.ts";
import { druckbar, metadaten, type Schreiber, schreiber, schriften } from "../pdf/schreiber.ts";
import {
  datumText,
  dauerText,
  halbtageText,
  monatText,
  tagText,
  uhrzeitText,
  zeitpunktText,
} from "./format.ts";

/** A day of the time sheet: first and last stamp, break and work in whole minutes, Soll, notes */
export type ZettelTag = {
  tag: string;
  beginn: number | null;
  ende: number | null;
  pauseMinuten: number;
  arbeitsMinuten: number;
  /** null: no model on the day ("nicht hinterlegt") */
  sollMinuten: number | null;
  /** the day's approved absences in words, e.g. „Urlaub“ (S-401); null without one */
  abwesenheit?: string | null;
  hinweise: string[];
};

export type ZettelBefund = {
  regel: string;
  norm: string;
  schwere: "hinweis" | "verstoss";
  tage: string[];
};

/** A start balance: overtime in minutes or leave in half days, with its reason (S-708) */
export type ZettelStartsaldo =
  | { art: "ueberstunden"; minuten: number; grund: string }
  | { art: "urlaub"; halbtage: number; grund: string };

/** What a time sheet shows (S-306); the server builds it from the month's content */
export type Stundenzettel = {
  betrieb: string;
  person: string;
  monat: string;
  tage: ZettelTag[];
  summen: {
    sollMinuten: number;
    istMinuten: number;
    saldoMinuten: number;
    gearbeitetMinuten: number;
    gutschriftMinuten: number;
    pausenabzugMinuten?: number;
  } | null;
  nichtHinterlegt: string[];
  befunde: ZettelBefund[];
  gegeneintraege: { tag: string; minuten: number; grund: string }[];
  /** the start balances on the first day of the month (S-708), as its content records them */
  startsalden?: ZettelStartsaldo[];
  bestaetigt: { name: string; am: number } | null;
  abgeschlossen: { name: string; am: number; grund: string | null } | null;
  /** „Nr. 1234 · <SHA-256>“ of the closing, null while the month is open */
  pruefwert: string | null;
  /** where the person checks the Prüfwert */
  pruefseite: string;
};

const SPALTEN = [
  { titel: "Tag", x: 0 },
  { titel: "Beginn", x: 62 },
  { titel: "Ende", x: 104 },
  { titel: "Pause", x: 146 },
  { titel: "Dauer", x: 184 },
  { titel: "Soll", x: 222 },
  { titel: "Hinweis", x: 262 },
] as const;

const kopf = (s: Schreiber, zettel: Stundenzettel) => {
  s.text(`Stundenzettel ${monatText(zettel.monat)}`, 0, { fett: true, groesse: 14 });
  s.zeile(18);
  s.text(`${zettel.person} · ${zettel.betrieb}`, 0, { groesse: 10 });
  s.zeile(14);
  const stand = zettel.abgeschlossen
    ? `Abgeschlossen am ${zeitpunktText(zettel.abgeschlossen.am)} von ${zettel.abgeschlossen.name}`
    : "Entwurf: Monat noch nicht abgeschlossen";
  s.text(stand, 0, { grau: true });
  s.zeile();
  s.text(
    zettel.bestaetigt
      ? `Bestätigt am ${zeitpunktText(zettel.bestaetigt.am)} von ${zettel.bestaetigt.name}`
      : "Von der Person nicht bestätigt",
    0,
    { grau: true },
  );
  s.zeile();
  if (zettel.abgeschlossen?.grund) {
    s.absatz(`Abgeschlossen ohne Bestätigung, Grund: ${zettel.abgeschlossen.grund}`, {
      grau: true,
    });
  }
  s.zeile(8);
};

const tabelle = (s: Schreiber, zettel: Stundenzettel) => {
  const titel = () => {
    for (const spalte of SPALTEN) s.text(spalte.titel, spalte.x, { fett: true });
    s.zeile();
  };
  titel();
  for (const tag of zettel.tage) {
    s.platz(1);
    const werte = [
      tagText(tag.tag),
      tag.beginn === null ? "" : uhrzeitText(tag.beginn),
      tag.ende === null ? "" : uhrzeitText(tag.ende),
      tag.beginn === null ? "" : dauerText(tag.pauseMinuten),
      tag.beginn === null ? "" : dauerText(tag.arbeitsMinuten),
      tag.sollMinuten === null ? "–" : dauerText(tag.sollMinuten),
      [tag.abwesenheit ?? "", ...tag.hinweise].filter((teil) => teil !== "").join(" · "),
    ];
    werte.forEach((wert, index) => {
      const spalte = SPALTEN[index];
      const naechste = SPALTEN[index + 1];
      if (spalte) s.text(wert, spalte.x, naechste ? { breite: naechste.x - spalte.x - 4 } : {});
    });
    s.zeile();
  }
  s.zeile(6);
};

const summen = (s: Schreiber, zettel: Stundenzettel) => {
  s.platz(3);
  if (zettel.summen === null) {
    s.absatz(
      `Soll und Ist: nicht hinterlegt (${zettel.nichtHinterlegt.map(datumText).join(", ")})`,
      { fett: true },
    );
  } else {
    const { sollMinuten, istMinuten, saldoMinuten, gutschriftMinuten, pausenabzugMinuten } =
      zettel.summen;
    s.text(
      `Soll ${dauerText(sollMinuten)} · Ist ${dauerText(istMinuten)} · Saldo ${dauerText(saldoMinuten, true)}` +
        (gutschriftMinuten > 0 ? ` · davon Gutschrift ${dauerText(gutschriftMinuten)}` : ""),
      0,
      { fett: true },
    );
    s.zeile();
    if ((pausenabzugMinuten ?? 0) > 0) {
      s.text(`Automatischer Pausenabzug: ${dauerText(pausenabzugMinuten ?? 0)} (§ 4 ArbZG)`, 0, {
        grau: true,
      });
      s.zeile();
    }
  }
  s.zeile(6);
};

const befunde = (s: Schreiber, zettel: Stundenzettel) => {
  if (zettel.befunde.length === 0) return;
  s.platz(2);
  s.text("Befunde", 0, { fett: true });
  s.zeile();
  for (const befund of zettel.befunde) {
    s.absatz(`${befundText(befund)} · ${befund.tage.map(datumText).join(", ")}`);
  }
  s.zeile(6);
};

const gegeneintraege = (s: Schreiber, zettel: Stundenzettel) => {
  if (zettel.gegeneintraege.length === 0) return;
  s.platz(2);
  s.text("Gegeneinträge zu abgeschlossenen Monaten", 0, { fett: true });
  s.zeile();
  for (const eintrag of zettel.gegeneintraege) {
    s.absatz(
      `${datumText(eintrag.tag)}: ${dauerText(eintrag.minuten, true)} · Grund: ${eintrag.grund}`,
    );
  }
  s.zeile(6);
};

const startsalden = (s: Schreiber, zettel: Stundenzettel) => {
  const liste = zettel.startsalden ?? [];
  if (liste.length === 0) return;
  s.platz(2);
  s.text(`Startsaldo zum ${datumText(`${zettel.monat}-01`)}`, 0, { fett: true });
  s.zeile();
  for (const saldo of liste)
    s.absatz(
      saldo.art === "ueberstunden"
        ? `Überstunden: ${dauerText(saldo.minuten, true)} · Grund: ${saldo.grund}`
        : `Resturlaub: ${halbtageText(saldo.halbtage)} · Grund: ${saldo.grund}`,
    );
  s.zeile(6);
};

const pruefwert = (s: Schreiber, zettel: Stundenzettel) => {
  s.platz(4);
  s.text("Prüfwert", 0, { fett: true });
  s.zeile();
  if (zettel.pruefwert === null) {
    s.absatz("Entsteht beim Abschluss des Monats.", { grau: true });
    return;
  }
  s.text(zettel.pruefwert, 0, { groesse: 7.5 });
  s.zeile();
  s.absatz(
    `Bewahre diesen Wert auf. Ändert sich später etwas an diesem Monat, zeigt die Prüfseite die Abweichung: ${zettel.pruefseite}`,
    { grau: true },
  );
};

/** The time sheet as a PDF with pdf-lib (docs/plan.md, "Exporte"), A4, German */
export const stundenzettelPdf = async (zettel: Stundenzettel): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const schrift = await schriften(doc);
  metadaten(doc, {
    titel: druckbar(schrift.normal, `Stundenzettel ${monatText(zettel.monat)} · ${zettel.person}`),
    betreff: zettel.pruefwert ?? "Entwurf",
    // fixed dates, so the same sheet gives the same file
    stand: zettel.abgeschlossen?.am ?? 0,
  });
  const s = schreiber(doc, schrift);
  kopf(s, zettel);
  tabelle(s, zettel);
  summen(s, zettel);
  befunde(s, zettel);
  gegeneintraege(s, zettel);
  startsalden(s, zettel);
  pruefwert(s, zettel);
  return doc.save();
};

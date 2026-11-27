import { PDFDocument, rgb } from "pdf-lib";
import { befundText } from "../befunde.ts";
import {
  druckbar,
  metadaten,
  type Schreiber,
  type Schrift,
  schreiber,
  schriften,
} from "../pdf/schreiber.ts";
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

const BREITE = 515.28;
const FARBE = {
  ink: rgb(0.04, 0.04, 0.05),
  muted: rgb(0.44, 0.44, 0.48),
  border: rgb(0.86, 0.86, 0.89),
  borderStrong: rgb(0.74, 0.74, 0.78),
  headBg: rgb(0.95, 0.95, 0.96),
  zebraBg: rgb(0.985, 0.985, 0.99),
  green: rgb(0.08, 0.5, 0.24),
  red: rgb(0.73, 0.11, 0.11),
} as const;

const SPALTEN = {
  tag: 6,
  beginn: 92,
  ende: 136,
  pause: 178,
  dauer: 222,
  soll: 266,
  saldo: 314,
  hinweis: 326,
} as const;

const neueWoche = (vorher: string | undefined, aktuell: string): boolean => {
  if (!vorher) return false;
  return (
    (Date.parse(`${aktuell}T12:00:00Z`) - Date.parse(`${vorher}T12:00:00Z`)) / 86_400_000 > 1.5
  );
};

const kopf = (s: Schreiber, zettel: Stundenzettel) => {
  s.text(`Stundenzettel ${monatText(zettel.monat)}`, 0, { fett: true, groesse: 15 });
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
  s.bereich(10, (seite, x, oben) => {
    seite.drawLine({
      start: { x, y: oben - 2 },
      end: { x: x + BREITE, y: oben - 2 },
      thickness: 0.7,
      color: FARBE.border,
    });
  });
};

const rechts = (
  seite: Parameters<Parameters<Schreiber["bereich"]>[1]>[0],
  schrift: Schrift,
  inhalt: string,
  xRechts: number,
  y: number,
  opt: { fett?: boolean; farbe?: ReturnType<typeof rgb> } = {},
) => {
  const font = opt.fett ? schrift.fett : schrift.normal;
  const sicher = druckbar(font, inhalt);
  const b = font.widthOfTextAtSize(sicher, 8.5);
  seite.drawText(sicher, { x: xRechts - b, y, size: 8.5, font, color: opt.farbe ?? FARBE.ink });
};

const tabelle = (s: Schreiber, schrift: Schrift, zettel: Stundenzettel) => {
  const kopfZeile = () => {
    s.bereich(20, (seite, x, oben) => {
      seite.drawRectangle({
        x,
        y: oben - 18,
        width: BREITE,
        height: 18,
        color: FARBE.headBg,
        borderColor: FARBE.border,
        borderWidth: 0.6,
      });
      const y = oben - 12;
      seite.drawText("Tag", {
        x: x + SPALTEN.tag,
        y,
        size: 8.5,
        font: schrift.fett,
        color: FARBE.muted,
      });
      rechts(seite, schrift, "Beginn", x + SPALTEN.beginn, y, { fett: true, farbe: FARBE.muted });
      rechts(seite, schrift, "Ende", x + SPALTEN.ende, y, { fett: true, farbe: FARBE.muted });
      rechts(seite, schrift, "Pause", x + SPALTEN.pause, y, { fett: true, farbe: FARBE.muted });
      rechts(seite, schrift, "Dauer", x + SPALTEN.dauer, y, { fett: true, farbe: FARBE.muted });
      rechts(seite, schrift, "Soll", x + SPALTEN.soll, y, { fett: true, farbe: FARBE.muted });
      rechts(seite, schrift, "Saldo", x + SPALTEN.saldo, y, { fett: true, farbe: FARBE.muted });
      seite.drawText("Hinweis", {
        x: x + SPALTEN.hinweis,
        y,
        size: 8.5,
        font: schrift.fett,
        color: FARBE.muted,
      });
    });
  };
  kopfZeile();
  zettel.tage.forEach((tag, index) => {
    const wochenStart = index > 0 && neueWoche(zettel.tage[index - 1]?.tag, tag.tag);
    const zeilenHoehe = 15;
    s.bereich(zeilenHoehe, (seite, x, oben) => {
      if (index % 2 === 1) {
        seite.drawRectangle({
          x,
          y: oben - zeilenHoehe,
          width: BREITE,
          height: zeilenHoehe,
          color: FARBE.zebraBg,
        });
      }
      seite.drawLine({
        start: { x, y: oben },
        end: { x: x + BREITE, y: oben },
        thickness: wochenStart ? 0.9 : 0.4,
        color: wochenStart ? FARBE.borderStrong : FARBE.border,
      });
      const y = oben - 10.5;
      const hatZeit = tag.beginn !== null;
      const diff =
        hatZeit && tag.sollMinuten !== null ? tag.arbeitsMinuten - tag.sollMinuten : null;
      const diffFarbe =
        diff === null ? FARBE.muted : diff > 0 ? FARBE.green : diff < 0 ? FARBE.red : FARBE.muted;
      seite.drawText(druckbar(schrift.fett, tagText(tag.tag)), {
        x: x + SPALTEN.tag,
        y,
        size: 8.5,
        font: schrift.fett,
        color: FARBE.ink,
      });
      if (hatZeit && tag.beginn !== null)
        rechts(seite, schrift, uhrzeitText(tag.beginn), x + SPALTEN.beginn, y, {
          farbe: FARBE.muted,
        });
      if (hatZeit && tag.ende !== null)
        rechts(seite, schrift, uhrzeitText(tag.ende), x + SPALTEN.ende, y, { farbe: FARBE.muted });
      if (hatZeit) {
        rechts(seite, schrift, dauerText(tag.pauseMinuten), x + SPALTEN.pause, y, {
          farbe: FARBE.muted,
        });
        rechts(seite, schrift, dauerText(tag.arbeitsMinuten), x + SPALTEN.dauer, y, { fett: true });
      }
      rechts(
        seite,
        schrift,
        tag.sollMinuten === null ? "–" : dauerText(tag.sollMinuten),
        x + SPALTEN.soll,
        y,
        {
          farbe: FARBE.muted,
        },
      );
      rechts(seite, schrift, diff === null ? "–" : dauerText(diff, true), x + SPALTEN.saldo, y, {
        fett: diff !== null,
        farbe: diffFarbe,
      });
      const hinweis = [tag.abwesenheit ?? "", ...tag.hinweise]
        .filter((teil) => teil !== "")
        .join(" · ");
      if (hinweis) {
        let sicher = druckbar(schrift.normal, hinweis);
        const maxB = BREITE - SPALTEN.hinweis - 4;
        while (sicher.length > 1 && schrift.normal.widthOfTextAtSize(sicher, 8) > maxB)
          sicher = `${sicher.slice(0, -2)}…`;
        seite.drawText(sicher, {
          x: x + SPALTEN.hinweis,
          y,
          size: 8,
          font: schrift.normal,
          color: FARBE.muted,
        });
      }
    });
  });
  s.bereich(8, (seite, x, oben) => {
    seite.drawLine({
      start: { x, y: oben },
      end: { x: x + BREITE, y: oben },
      thickness: 0.7,
      color: FARBE.border,
    });
  });
};

const summen = (s: Schreiber, schrift: Schrift, zettel: Stundenzettel) => {
  s.platz(3);
  if (zettel.summen === null) {
    s.absatz(
      `Soll und Ist: nicht hinterlegt (${zettel.nichtHinterlegt.map(datumText).join(", ")})`,
      { fett: true },
    );
  } else {
    const { sollMinuten, istMinuten, saldoMinuten, gutschriftMinuten, pausenabzugMinuten } =
      zettel.summen;
    const text =
      `Soll ${dauerText(sollMinuten)} · Ist ${dauerText(istMinuten)} · Saldo ${dauerText(saldoMinuten, true)}` +
      (gutschriftMinuten > 0 ? ` · davon Gutschrift ${dauerText(gutschriftMinuten)}` : "");
    s.bereich(24, (seite, x, oben) => {
      seite.drawRectangle({
        x,
        y: oben - 20,
        width: BREITE,
        height: 20,
        color: FARBE.headBg,
        borderColor: FARBE.border,
        borderWidth: 0.6,
      });
      seite.drawText(druckbar(schrift.fett, text), {
        x: x + 8,
        y: oben - 13,
        size: 9,
        font: schrift.fett,
        color: FARBE.ink,
      });
    });
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
  tabelle(s, schrift, zettel);
  summen(s, schrift, zettel);
  befunde(s, zettel);
  gegeneintraege(s, zettel);
  startsalden(s, zettel);
  pruefwert(s, zettel);
  return doc.save();
};

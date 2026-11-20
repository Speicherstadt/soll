import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { datumText, dauerText, monatText, tagText, uhrzeitText, zeitpunktText } from "./format.ts";

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
  } | null;
  nichtHinterlegt: string[];
  befunde: ZettelBefund[];
  gegeneintraege: { tag: string; minuten: number; grund: string }[];
  bestaetigt: { name: string; am: number } | null;
  abgeschlossen: { name: string; am: number; grund: string | null } | null;
  /** „Nr. 1234 · <SHA-256>“ of the closing, null while the month is open */
  pruefwert: string | null;
  /** where the person checks the Prüfwert */
  pruefseite: string;
};

/** The rules on the sheet, with the words of docs/regeln.md */
const REGELN: Record<string, string> = {
  "R-01": "Stempelung unvollständig",
  "R-02": "Höchstarbeitszeit",
  "R-04": "Ruhepause",
  "R-05": "Ruhezeit",
  "R-24": "Krank im Urlaub ohne Bescheinigung",
};

const RAND = 40;
const BREITE = 595.28;
const HOEHE = 841.89;
const ZEILE = 13;
const SPALTEN = [
  { titel: "Tag", x: 0 },
  { titel: "Beginn", x: 62 },
  { titel: "Ende", x: 104 },
  { titel: "Pause", x: 146 },
  { titel: "Dauer", x: 184 },
  { titel: "Soll", x: 222 },
  { titel: "Hinweis", x: 262 },
] as const;

type Schrift = { normal: PDFFont; fett: PDFFont };

/**
 * The standard fonts know only WinAnsi: a letter outside it is written without its accent, or as
 * "?" (a name in Cyrillic or Arabic; docs/plan.md, "Sprache des Stundenzettels")
 */
export const druckbar = (font: PDFFont, text: string): string =>
  [...text]
    .map((zeichen) => {
      const versuche = [zeichen, zeichen.normalize("NFD").replace(/\p{M}/gu, "")];
      return (
        versuche.find((versuch) => {
          try {
            font.encodeText(versuch);
            return versuch.length > 0;
          } catch {
            return false;
          }
        }) ?? "?"
      );
    })
    .join("");

/** A writer over pages: starts a new page when the next line does not fit */
const schreiber = (doc: PDFDocument, schrift: Schrift) => {
  let seite: PDFPage = doc.addPage([BREITE, HOEHE]);
  let y = HOEHE - RAND;
  const platz = (zeilen: number) => {
    if (y - zeilen * ZEILE >= RAND) return;
    seite = doc.addPage([BREITE, HOEHE]);
    y = HOEHE - RAND;
  };
  const text = (
    inhalt: string,
    x: number,
    optionen: { fett?: boolean; groesse?: number; breite?: number; grau?: boolean } = {},
  ) => {
    const font = optionen.fett ? schrift.fett : schrift.normal;
    const groesse = optionen.groesse ?? 9;
    let sicher = druckbar(font, inhalt);
    const breite = optionen.breite ?? BREITE - 2 * RAND - x;
    while (sicher.length > 1 && font.widthOfTextAtSize(sicher, groesse) > breite)
      sicher = `${sicher.slice(0, -2)}…`;
    seite.drawText(sicher, {
      x: RAND + x,
      y,
      size: groesse,
      font,
      color: optionen.grau ? rgb(0.44, 0.44, 0.48) : rgb(0.04, 0.04, 0.04),
    });
  };
  const zeile = (abstand = ZEILE) => {
    y -= abstand;
  };
  /** A paragraph wrapped at the width of the page */
  const absatz = (inhalt: string, optionen: { fett?: boolean; grau?: boolean } = {}) => {
    const font = optionen.fett ? schrift.fett : schrift.normal;
    const woerter = druckbar(font, inhalt).split(" ");
    let teil = "";
    for (const wort of woerter) {
      const probe = teil ? `${teil} ${wort}` : wort;
      if (font.widthOfTextAtSize(probe, 9) > BREITE - 2 * RAND && teil) {
        platz(1);
        text(teil, 0, optionen);
        zeile();
        teil = wort;
      } else teil = probe;
    }
    if (teil) {
      platz(1);
      text(teil, 0, optionen);
      zeile();
    }
  };
  return { text, zeile, absatz, platz };
};

const kopf = (s: ReturnType<typeof schreiber>, zettel: Stundenzettel) => {
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

const tabelle = (s: ReturnType<typeof schreiber>, zettel: Stundenzettel) => {
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

const summen = (s: ReturnType<typeof schreiber>, zettel: Stundenzettel) => {
  s.platz(3);
  if (zettel.summen === null) {
    s.absatz(
      `Soll und Ist: nicht hinterlegt (${zettel.nichtHinterlegt.map(datumText).join(", ")})`,
      { fett: true },
    );
  } else {
    const { sollMinuten, istMinuten, saldoMinuten, gutschriftMinuten } = zettel.summen;
    s.text(
      `Soll ${dauerText(sollMinuten)} · Ist ${dauerText(istMinuten)} · Saldo ${dauerText(saldoMinuten, true)}` +
        (gutschriftMinuten > 0 ? ` · davon Gutschrift ${dauerText(gutschriftMinuten)}` : ""),
      0,
      { fett: true },
    );
    s.zeile();
  }
  s.zeile(6);
};

const befunde = (s: ReturnType<typeof schreiber>, zettel: Stundenzettel) => {
  if (zettel.befunde.length === 0) return;
  s.platz(2);
  s.text("Befunde", 0, { fett: true });
  s.zeile();
  for (const befund of zettel.befunde) {
    const schwere = befund.schwere === "verstoss" ? "Verstoß" : "Hinweis";
    s.absatz(
      `${schwere}: ${REGELN[befund.regel] ?? befund.regel} · ${befund.norm} · ${befund.tage.map(datumText).join(", ")}`,
    );
  }
  s.zeile(6);
};

const gegeneintraege = (s: ReturnType<typeof schreiber>, zettel: Stundenzettel) => {
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

const pruefwert = (s: ReturnType<typeof schreiber>, zettel: Stundenzettel) => {
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
  const schrift = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    fett: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  doc.setTitle(
    druckbar(schrift.normal, `Stundenzettel ${monatText(zettel.monat)} · ${zettel.person}`),
  );
  doc.setSubject(zettel.pruefwert ?? "Entwurf");
  doc.setProducer("Soll");
  doc.setCreator("Soll");
  // fixed dates, so the same sheet gives the same file
  const stand = new Date(zettel.abgeschlossen?.am ?? 0);
  doc.setCreationDate(stand);
  doc.setModificationDate(stand);
  const s = schreiber(doc, schrift);
  kopf(s, zettel);
  tabelle(s, zettel);
  summen(s, zettel);
  befunde(s, zettel);
  gegeneintraege(s, zettel);
  pruefwert(s, zettel);
  return doc.save();
};

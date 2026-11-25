import { type PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";

/*
 * Writing text onto pages with pdf-lib, shared by the time sheet (S-306), the Prüfexport (S-309) and
 * the Stundennachweis (S-605): the standard fonts, lines that start a new page when they do not fit,
 * wrapped paragraphs, room for a drawing.
 */

export const RAND = 40;
export const ZEILE = 13;
/** A4 in points, portrait */
export const A4 = { breite: 595.28, hoehe: 841.89 } as const;
/** A4 in points, landscape */
export const A4_QUER = { breite: 841.89, hoehe: 595.28 } as const;

export type Schrift = { normal: PDFFont; fett: PDFFont };
export type Format = { breite: number; hoehe: number };

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

/**
 * One paragraph (no line breaks) broken into lines that fit `breite` points at size `groesse`: at
 * spaces, and inside a word only when the word alone is wider
 */
const absatzUmbrechen = (
  text: string,
  font: PDFFont,
  masse: { groesse: number; breite: number },
): string[] => {
  const passt = (probe: string) => font.widthOfTextAtSize(probe, masse.groesse) <= masse.breite;
  const zeilen: string[] = [];
  let teil = "";
  for (const wort of text.split(" ")) {
    const probe = teil ? `${teil} ${wort}` : wort;
    if (passt(probe) || !teil) teil = probe;
    else {
      zeilen.push(teil);
      teil = wort;
    }
    while (teil.length > 1 && !passt(teil)) {
      const laenge = Math.max(
        1,
        [...teil].findIndex((_, ende) => !passt(teil.slice(0, ende + 1))),
      );
      zeilen.push(teil.slice(0, laenge));
      teil = teil.slice(laenge);
    }
  }
  return [...zeilen, teil];
};

/** Helvetica and Helvetica Bold, embedded in the document */
export const schriften = async (doc: PDFDocument): Promise<Schrift> => ({
  normal: await doc.embedFont(StandardFonts.Helvetica),
  fett: await doc.embedFont(StandardFonts.HelveticaBold),
});

export type TextOptionen = {
  fett?: boolean;
  groesse?: number;
  breite?: number;
  grau?: boolean;
  /** Points below the current line, for the further lines of a wrapped table cell */
  unten?: number;
};

/** A writer over pages: starts a new page when the next line does not fit */
export const schreiber = (doc: PDFDocument, schrift: Schrift, format: Format = A4) => {
  let seite: PDFPage = doc.addPage([format.breite, format.hoehe]);
  let y = format.hoehe - RAND;
  const neueSeite = () => {
    seite = doc.addPage([format.breite, format.hoehe]);
    y = format.hoehe - RAND;
  };
  const platz = (zeilen: number) => {
    if (y - zeilen * ZEILE < RAND) neueSeite();
  };
  /** How many lines still fit on this page; `jeSeite` is how many fit on a new one */
  const frei = () => Math.max(0, Math.floor((y - RAND) / ZEILE));
  const jeSeite = Math.floor((format.hoehe - 2 * RAND) / ZEILE);
  const text = (inhalt: string, x: number, optionen: TextOptionen = {}) => {
    const font = optionen.fett ? schrift.fett : schrift.normal;
    const groesse = optionen.groesse ?? 9;
    let sicher = druckbar(font, inhalt);
    const breite = optionen.breite ?? format.breite - 2 * RAND - x;
    while (sicher.length > 1 && font.widthOfTextAtSize(sicher, groesse) > breite)
      sicher = `${sicher.slice(0, -2)}…`;
    seite.drawText(sicher, {
      x: RAND + x,
      y: y - (optionen.unten ?? 0),
      size: groesse,
      font,
      color: optionen.grau ? rgb(0.44, 0.44, 0.48) : rgb(0.04, 0.04, 0.04),
    });
  };
  const zeile = (abstand = ZEILE) => {
    y -= abstand;
  };
  /**
   * Text broken into lines that fit `breite` points (the rest of the page by default): at its line
   * breaks (also U+0085, U+2028, U+2029), at spaces (a tab or form feed counts as one), and inside
   * a word only when the word alone is wider, so nothing is cut off
   */
  const umbrechen = (inhalt: string, x = 0, optionen: TextOptionen = {}): string[] => {
    const font = optionen.fett ? schrift.fett : schrift.normal;
    const masse = {
      groesse: optionen.groesse ?? 9,
      breite: optionen.breite ?? format.breite - 2 * RAND - x,
    };
    return inhalt
      .split(/\r\n|[\r\n\u0085\u2028\u2029]/)
      .map((teil) => teil.replace(/[\t\v\f]/g, " "))
      .flatMap((teil) => absatzUmbrechen(druckbar(font, teil), font, masse));
  };
  /** A paragraph wrapped at the width of the page */
  const absatz = (inhalt: string, optionen: { fett?: boolean; grau?: boolean } = {}) => {
    for (const teil of umbrechen(inhalt, 0, optionen).filter(Boolean)) {
      platz(1);
      text(teil, 0, optionen);
      zeile();
    }
  };
  /**
   * Room of `hoehe` points for a drawing (a signature), on a new page when it does not fit; the
   * drawing gets the page and the top left corner of its room
   */
  const bereich = (hoehe: number, zeichnen: (seite: PDFPage, x: number, oben: number) => void) => {
    if (y - hoehe < RAND) neueSeite();
    zeichnen(seite, RAND, y);
    y -= hoehe;
  };
  return { text, zeile, umbrechen, absatz, platz, frei, jeSeite, neueSeite, bereich };
};

export type Schreiber = ReturnType<typeof schreiber>;

/** Fixed metadata, so the same content gives the same file */
export const metadaten = (
  doc: PDFDocument,
  angaben: { titel: string; betreff: string; stand: number },
) => {
  doc.setTitle(angaben.titel);
  doc.setSubject(angaben.betreff);
  doc.setProducer("Soll");
  doc.setCreator("Soll");
  doc.setCreationDate(new Date(angaben.stand));
  doc.setModificationDate(new Date(angaben.stand));
};

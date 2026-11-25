/*
 * The norms docs/regeln.md cites: every "§ …" or "§§ …" that names its law, e.g. "§ 3 Abs. 2 Nr. 1
 * ArbSchG" → § 3 ArbSchG, "§§ 2, 6 Abs. 2 ArbZG" → §§ 2 and 6, "§§ 15 bis 18 JArbSchG" → §§ 15 to 18,
 * "§ 2 Abs. 3 bis 5 ArbZG" → § 2 (a range inside the paragraph), "§ 4 Abs. 2, § 12 JArbSchG" → §§ 4
 * and 12 (a chain sharing the law named at its end). A "§" without a law after it ("§ 5 Abs. 2 wie
 * R-05") points back into the text and is no citation of its own. Articles ("Art. 9 DSGVO") are EU
 * law and not on gesetze-im-internet.de.
 */

export type Fundstelle = { gesetz: string; paragraf: string };

const QUALIFIER = new Set(["Abs.", "Satz", "Nr.", "Buchst.", "lit.", "Halbsatz", "Alt.", "Var."]);
/** A law's abbreviation: letters with at least two capitals, maybe a number (ArbZG, SvEV, MiLoV5) */
const GESETZ = /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*\d*$/;
const ROEMISCH = /^[IVX]+$/;
const ZAHL = /^\d+[a-z]?$/;

const istGesetz = (wort: string) =>
  GESETZ.test(wort) && (wort.match(/[A-ZÄÖÜ]/g)?.length ?? 0) >= 2;

/**
 * The widest range of paragraphs read as one: the ranges docs/regeln.md cites span a few ("§§ 15
 * bis 18 JArbSchG"); a wider or reversed one ("§ 8 bis 2026 SGB IV", a year) is no range of
 * paragraphs
 */
const LAENGSTER_BEREICH = 20;

/** "15 bis 18" → 15, 16, 17, 18; "3a bis 3c" → both; otherwise only the first paragraph */
const bereich = (von: string, bis: string): string[] => {
  if (!/^\d+$/.test(von) || !/^\d+$/.test(bis)) return [von, bis];
  const [a, b] = [Number(von), Number(bis)];
  if (b <= a || b - a + 1 > LAENGSTER_BEREICH) return [von];
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
};

/**
 * The reading so far: the paragraphs still waiting for their law; whether the words read since the
 * last paragraph are its parts ("Abs. 3 bis 5"); whether the next number is a paragraph (after "§",
 * or after "," in "§§ …"); whether a "bis" between paragraphs waits for its end
 */
type Zustand = {
  offen: string[];
  mehrere: boolean;
  teil: boolean;
  neu: boolean;
  bis: boolean;
};

/** Reads one number: a paragraph, the end of a range of paragraphs, or a part of the last one */
const zahl = (z: Zustand, wort: string): void => {
  const letzter = z.offen.at(-1);
  if (z.neu || letzter === undefined) z.offen.push(wort);
  else if (z.teil) {
    // "Abs. 1, 1a": a part of the last paragraph
  } else if (z.bis) z.offen.splice(-1, 1, ...bereich(letzter, wort));
  else if (z.mehrere) z.offen.push(wort);
  // "§ 5 6": a number after one paragraph without "bis" is read as a part of it
  else z.teil = true;
  z.neu = false;
  z.bis = false;
};

/** A separator: "," or "und"; in "§§ …" the next number outside a part is a paragraph again */
const trenner = (z: Zustand): void => {
  if (z.mehrere) {
    z.teil = false;
    z.neu = true;
  }
};

/** The law of a word, "SGB" with its book ("SGB IV"), or null */
const gesetzVon = (wort: string, naechstes = ""): string | null => {
  const name = wort.replace(/\.$/, "");
  if (!istGesetz(name)) return null;
  const buch = naechstes.replace(/\.$/, "");
  return name === "SGB" && ROEMISCH.test(buch) ? `SGB ${buch}` : name;
};

/** Reads one word that is neither number nor law; false ends the citation */
const sonstiges = (z: Zustand, wort: string): boolean => {
  if (QUALIFIER.has(wort)) {
    // "§§ 15, 16 Abs. 2, Abs. 3": after "Abs." the next number is a part, not a paragraph
    z.teil = true;
    z.neu = false;
  } else if (wort === "," || (wort === "und" && !z.teil)) trenner(z);
  else if (wort === "bis") z.bis = !z.teil;
  else if (wort === "ff." || wort === "und" || (z.teil && /^[a-z]$/.test(wort))) return true;
  else return false;
  return true;
};

/** What one citation gives: its paragraphs with their law, and those still waiting for one */
type Lesung = { gefunden: Fundstelle[]; offen: string[] };

/**
 * The paragraphs and laws of the words after "§" or "§§" (`mehrere`), up to the first word that is
 * no part of a citation. `offen` holds paragraphs a citation before it left without a law ("§ 4
 * Abs. 2, " before "§ 12 JArbSchG"); paragraphs still without a law come back in `offen` only when
 * every word was read and the last is "," or "und", so the next "§" may name their law.
 */
export const fundstelle = (
  mehrere: boolean,
  woerter: readonly string[],
  offen: readonly string[] = [],
): Lesung => {
  const z: Zustand = { offen: [...offen], mehrere, teil: false, neu: true, bis: false };
  const gefunden: Fundstelle[] = [];
  for (const [i, wort] of woerter.entries()) {
    const gesetz = z.offen.length > 0 ? gesetzVon(wort, woerter[i + 1]) : null;
    if (gesetz !== null) {
      gefunden.push(...z.offen.map((paragraf) => ({ gesetz, paragraf })));
      z.offen = [];
      z.neu = false;
    } else if (ZAHL.test(wort) && (z.offen.length > 0 || z.neu)) zahl(z, wort);
    else if (!sonstiges(z, wort)) return { gefunden, offen: [] };
  }
  const weiter = woerter.at(-1) === "," || woerter.at(-1) === "und";
  return { gefunden, offen: weiter ? z.offen : [] };
};

const WORT = /\d+[a-z]?|,|[A-Za-zÄÖÜäöüß]+\.?|\S/g;

/** "§ 3 ArbZG": how a citation is written, and the key of the watch list */
export const zitierweise = ({ gesetz, paragraf }: Fundstelle): string => `§ ${paragraf} ${gesetz}`;

/** A citation runs to the next "§", ";", quote, bracket or table cell */
const ZITAT = /(§§?) ([^;:„“"()|§*\]]*)/g;

/**
 * Each citation on its own, so prose in one ("§ 5 Abs. 2 wie oben, § 7 ArbZG") never hides the
 * next; paragraphs left without a law pass on to a "§" right after them, which shares its law
 */
const alleFundstellen = (text: string): Fundstelle[] => {
  const gefunden: Fundstelle[] = [];
  let offen: string[] = [];
  let ende = -1;
  for (const treffer of text.replace(/\s+/g, " ").matchAll(ZITAT)) {
    const [ganz, zeichen, rest = ""] = treffer;
    const lesung = fundstelle(
      zeichen === "§§",
      rest.match(WORT) ?? [],
      treffer.index === ende ? offen : [],
    );
    gefunden.push(...lesung.gefunden);
    offen = lesung.offen;
    ende = treffer.index + ganz.length;
  }
  return gefunden;
};

/** Every cited paragraph, once, in the order of first appearance */
export const zitierteNormen = (text: string): Fundstelle[] => {
  const gesehen = new Set<string>();
  return alleFundstellen(text).filter((f) => {
    if (gesehen.has(zitierweise(f))) return false;
    gesehen.add(zitierweise(f));
    return true;
  });
};

/** The rules (### R-NN) of docs/regeln.md that cite each paragraph, e.g. "§ 4 ArbZG" → R-04 */
export const regelnJeNorm = (regeln: string): Map<string, string[]> => {
  const zuordnung = new Map<string, string[]>();
  for (const teil of regeln.split(/^### /m).filter((t) => /^R-\d{2} /.test(t))) {
    const regel = teil.slice(0, 4);
    for (const f of zitierteNormen(teil))
      zuordnung.set(zitierweise(f), [...(zuordnung.get(zitierweise(f)) ?? []), regel]);
  }
  return zuordnung;
};

/*
 * The norms docs/regeln.md cites: every "§ …" or "§§ …" that names its law, e.g. "§ 3 Abs. 2 Nr. 1
 * ArbSchG" → § 3 ArbSchG, "§§ 2, 6 Abs. 2 ArbZG" → §§ 2 and 6, "§§ 15 bis 18 JArbSchG" → §§ 15 to 18.
 * A "§" without a law after it ("§ 5 Abs. 2 wie R-05") points back into the text and is no citation
 * of its own. Articles ("Art. 9 DSGVO") are EU law and not on gesetze-im-internet.de.
 */

export type Fundstelle = { gesetz: string; paragraf: string };

const QUALIFIER = new Set(["Abs.", "Satz", "Nr.", "Buchst.", "lit.", "Halbsatz"]);
/** A law's abbreviation: letters with at least two capitals, maybe a number (ArbZG, SvEV, MiLoV5) */
const GESETZ = /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*\d*$/;
const ROEMISCH = /^[IVX]+$/;
const ZAHL = /^\d+[a-z]?$/;

const istGesetz = (wort: string) =>
  GESETZ.test(wort) && (wort.match(/[A-ZÄÖÜ]/g)?.length ?? 0) >= 2;

/** "15 bis 18" → 15, 16, 17, 18; only plain numbers form a range */
const bereich = (von: string, bis: string): string[] => {
  const [a, b] = [Number(von), Number(bis)];
  if (!/^\d+$/.test(von) || !/^\d+$/.test(bis) || b < a) return [von, bis];
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
};

type Zustand = { paragrafen: string[]; qualifier: boolean; bis: boolean };

/** Reads one number: a paragraph, or part of "Abs. …" which belongs to the paragraph before it */
const zahl = (z: Zustand, wort: string, mehrere: boolean): void => {
  const letzter = z.paragrafen.at(-1);
  if (letzter === undefined) z.paragrafen.push(wort);
  else if (mehrere && !z.qualifier)
    z.paragrafen.splice(-1, 1, ...(z.bis ? bereich(letzter, wort) : [letzter, wort]));
  if (!mehrere) z.qualifier = true;
  z.bis = false;
};

/** The paragraphs and the law of the words after "§" or "§§", or null without a law */
export const fundstelle = (mehrere: boolean, woerter: readonly string[]): Fundstelle[] | null => {
  const z: Zustand = { paragrafen: [], qualifier: false, bis: false };
  for (const [i, wort] of woerter.entries()) {
    if (ZAHL.test(wort)) zahl(z, wort, mehrere);
    else if (QUALIFIER.has(wort)) z.qualifier = true;
    else if (wort === "," || (wort === "und" && !z.qualifier))
      z.qualifier = mehrere ? false : z.qualifier;
    else if (wort === "bis" && !z.qualifier) z.bis = true;
    else if (wort === "ff." || wort === "und" || (z.qualifier && /^[a-z]$/.test(wort))) continue;
    else if (istGesetz(wort.replace(/\.$/, "")) && z.paragrafen.length > 0) {
      const naechstes = (woerter[i + 1] ?? "").replace(/\.$/, "");
      const name = wort.replace(/\.$/, "");
      const gesetz = name === "SGB" && ROEMISCH.test(naechstes) ? `SGB ${naechstes}` : name;
      return z.paragrafen.map((paragraf) => ({ gesetz, paragraf }));
    } else return null;
  }
  return null;
};

const WORT = /\d+[a-z]?|,|[A-Za-zÄÖÜäöüß]+\.?|\S/g;

/** "§ 3 ArbZG": how a citation is written, and the key of the watch list */
export const zitierweise = ({ gesetz, paragraf }: Fundstelle): string => `§ ${paragraf} ${gesetz}`;

const alleFundstellen = (text: string): Fundstelle[] =>
  [...text.replace(/\s+/g, " ").matchAll(/(§§?) ([^;:„“"()|§*\]]*)/g)].flatMap(
    ([, zeichen, rest = ""]) => fundstelle(zeichen === "§§", rest.match(WORT) ?? []) ?? [],
  );

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

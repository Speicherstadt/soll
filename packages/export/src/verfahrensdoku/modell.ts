/*
 * The data model of the Verfahrensdokumentation (GoBD, BMF-Schreiben vom 28.11.2019, Rz. 151 to 155):
 * a document of sections with paragraphs, lists and gaps, plain JSON, so the app shows it without
 * converting it and `alsMarkdown` and `verfahrensdokuPdf` print it.
 *
 * Copied from firsttris/haben, packages/gobd-kern/src/verfahrensdoku/modell.ts (AGPL-3.0, same
 * author), as CLAUDE.md asks: no dependency on gobd-kern. Gaps instead of placeholders: a missing
 * statement stands as a gap in its section and the document counts as incomplete, so nothing looks
 * filled in that is not.
 */

export type VerfahrensdokuAbschnitt = {
  titel: string;
  absaetze: string[];
  liste?: string[];
  /** What the business still has to state, as a short description of what is missing */
  luecken?: string[];
};

/**
 * The state of one version (Rz. 154: changes versioned and traceable, program versions named): the
 * day it was produced, the program with its version and the Prüfwert of the chain at that moment
 */
export type VerfahrensdokuStand = {
  /** YYYY-MM-DD in Europe/Berlin */
  datum: string;
  programm: string;
  version: string;
  /** "Nr. 1234 · <SHA-256>", null for a business without links yet */
  pruefwert: string | null;
};

export type Verfahrensdoku = {
  titel: string;
  stand: VerfahrensdokuStand;
  abschnitte: VerfahrensdokuAbschnitt[];
  /** The number of all gaps; 0 means complete */
  luecken: number;
  vollstaendig: boolean;
};

const voll = (texte?: readonly string[]) =>
  (texte ?? []).map((text) => text.trim()).filter(Boolean);

/** A section without empty paragraphs, items and gaps, so builders can write `bedingung ? text : ""` */
export const abschnitt = (
  titel: string,
  teile: { absaetze?: readonly string[]; liste?: readonly string[]; luecken?: readonly string[] },
): VerfahrensdokuAbschnitt => {
  const liste = voll(teile.liste);
  const luecken = voll(teile.luecken);
  return {
    titel,
    absaetze: voll(teile.absaetze),
    ...(liste.length ? { liste } : {}),
    ...(luecken.length ? { luecken } : {}),
  };
};

/** Puts the document together and counts its gaps */
export const verfahrensdoku = (teile: {
  titel: string;
  stand: VerfahrensdokuStand;
  abschnitte: VerfahrensdokuAbschnitt[];
}): Verfahrensdoku => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teile.stand.datum))
    throw new Error(`Stand without a day YYYY-MM-DD: ${teile.stand.datum}`);
  const luecken = teile.abschnitte.reduce((summe, a) => summe + (a.luecken?.length ?? 0), 0);
  return { ...teile, luecken, vollstaendig: luecken === 0 };
};

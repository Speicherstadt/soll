import type { Abwesenheit, Abwesenheitsart } from "./typen.ts";

/**
 * Absences that keep the day's Soll: the person is excused and owes no time. Leave (§ 1 BUrlG),
 * sickness (§ 3 Abs. 1, § 4 Abs. 1 EntgFG), Sonderurlaub (§ 616 BGB) and Kind krank (§ 45 Abs. 3
 * SGB V: „Anspruch auf unbezahlte Freistellung“) are credited with the Soll they cover; taking off
 * overtime (Überstundenabbau) is not: it is paid for by the account.
 */
const GUTGESCHRIEBEN: ReadonlySet<Abwesenheitsart> = new Set([
  "urlaub",
  "krank",
  "kind_krank",
  "sonderurlaub",
]);

/** A whole day counts two halves, a half day one */
export const umfang = (abwesenheit: Abwesenheit): number => (abwesenheit.halb === true ? 1 : 2);

const summe = (liste: readonly Abwesenheit[]): number =>
  liste.reduce((teil, abwesenheit) => teil + umfang(abwesenheit), 0);

/** Takes `halbe` halves off the entries of one kind, the last ones first */
const kuerzen = (liste: readonly Abwesenheit[], art: Abwesenheitsart, halbe: number) => {
  let offen = halbe;
  return [...liste]
    .reverse()
    .flatMap((abwesenheit): Abwesenheit[] => {
      if (abwesenheit.art !== art || offen === 0) return [abwesenheit];
      const weg = Math.min(offen, umfang(abwesenheit));
      offen -= weg;
      return weg === umfang(abwesenheit) ? [] : [{ ...abwesenheit, halb: true }];
    })
    .reverse();
};

export type AufgeloesteAbwesenheiten = {
  liste: Abwesenheit[];
  /** sickness without a certificate on a leave day: it counts as leave (§ 9 BUrlG, R-24) */
  ohneBescheinigung: boolean;
};

/**
 * The absences of one day as they count. Sickness and leave on the same time of a day: with a
 * certificate the sickness counts and the leave is not charged, without one the leave counts
 * (§ 9 BUrlG: „durch ärztliches Zeugnis nachgewiesen“, docs/regeln.md R-24). More than a day of
 * absence otherwise is no valid entry (null).
 */
export const abwesenheitenAufloesen = (
  liste: readonly Abwesenheit[],
): AufgeloesteAbwesenheiten | null => {
  const ueber = summe(liste) - 2;
  if (ueber <= 0) return { liste: [...liste], ohneBescheinigung: false };
  const krank = liste.filter((abwesenheit) => abwesenheit.art === "krank");
  if (krank.length === 0 || !liste.some((abwesenheit) => abwesenheit.art === "urlaub")) return null;
  const nachgewiesen = krank.some((abwesenheit) => abwesenheit.bescheinigung === true);
  const aufgeloest = kuerzen(liste, nachgewiesen ? "urlaub" : "krank", ueber);
  return summe(aufgeloest) > 2 ? null : { liste: aufgeloest, ohneBescheinigung: !nachgewiesen };
};

/**
 * The minutes credited to Ist for the day's absences: the Soll a whole day covers, half of it for a
 * half day rounded up (never to the person's disadvantage, CLAUDE.md), at most the Soll
 */
export const gutschrift = (liste: readonly Abwesenheit[], sollMinuten: number): number =>
  Math.min(
    sollMinuten,
    liste
      .filter((abwesenheit) => GUTGESCHRIEBEN.has(abwesenheit.art))
      .reduce(
        (teil, abwesenheit) =>
          teil + (abwesenheit.halb === true ? Math.ceil(sollMinuten / 2) : sollMinuten),
        0,
      ),
  );

/**
 * The leave a day charges, in half days: only a day with Soll, so neither a holiday nor a day off in
 * the model (§ 3 Abs. 2 BUrlG: „Werktage … die nicht Sonn- oder gesetzliche Feiertage sind“)
 */
export const urlaubAmTag = (liste: readonly Abwesenheit[], sollMinuten: number): number =>
  sollMinuten === 0 ? 0 : summe(liste.filter((abwesenheit) => abwesenheit.art === "urlaub"));

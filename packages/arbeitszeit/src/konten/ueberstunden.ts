import { istMonat, type Monat, plusMonate } from "../kalender/monat.ts";

/** A closed month (S-306): its Soll and Ist in whole minutes, as `monatsstand` gave them */
export type Abschluss = { monat: Monat; sollMinuten: number; istMinuten: number };

/**
 * A change of the account by hand, the only thing stored (docs/plan.md, "Konten",
 * `konto_anpassungen`): the balance at the start of a month when Soll begins (`startsaldo`, signed),
 * overtime paid out (`auszahlung`, taken off), or a correction (`korrektur`, signed)
 */
export type KontoAnpassung = {
  monat: Monat;
  art: "startsaldo" | "auszahlung" | "korrektur";
  minuten: number;
};

export type Kontomonat = {
  monat: Monat;
  /** Ist − Soll of the closed month; 0 for a month with adjustments only */
  differenzMinuten: number;
  anpassungMinuten: number;
  /** the balance at the end of the month */
  saldoMinuten: number;
};

export type Ueberstundenkonto = {
  saldoMinuten: number;
  verlauf: Kontomonat[];
  /**
   * months from the start balance (or the first closing) to the last closing that are not closed:
   * the balance misses them
   */
  luecken: Monat[];
};

export type KontoErgebnis =
  | { ok: true; wert: Ueberstundenkonto }
  | { ok: false; grund: "ungueltig" };

const ganz = (zahl: number): boolean => Number.isSafeInteger(zahl);

/**
 * Whole minutes, real months, one closing per month, one start balance with nothing before it, and a
 * payout that takes minutes off (a positive number)
 */
const gueltig = (abschluesse: readonly Abschluss[], anpassungen: readonly KontoAnpassung[]) => {
  const start = anpassungen.filter((anpassung) => anpassung.art === "startsaldo");
  const ab = start[0]?.monat ?? "";
  return (
    abschluesse.every((a) => istMonat(a.monat) && ganz(a.sollMinuten) && ganz(a.istMinuten)) &&
    new Set(abschluesse.map((a) => a.monat)).size === abschluesse.length &&
    anpassungen.every((a) => istMonat(a.monat) && ganz(a.minuten)) &&
    anpassungen.every((a) => a.art !== "auszahlung" || a.minuten > 0) &&
    start.length <= 1 &&
    [...abschluesse, ...anpassungen].every((eintrag) => eintrag.monat >= ab)
  );
};

const wirkung = (anpassung: KontoAnpassung): number =>
  anpassung.art === "auszahlung" ? -anpassung.minuten : anpassung.minuten;

/** The months from `ab` (else the first closed one) to the last closed one that are not closed */
const lueckenZwischen = (monate: readonly Monat[], ab: Monat | undefined): Monat[] => {
  const erster = ab ?? monate[0];
  const letzter = monate.at(-1);
  if (erster === undefined || letzter === undefined) return [];
  const vorhanden = new Set(monate);
  const luecken: Monat[] = [];
  for (let monat = erster; monat <= letzter; monat = plusMonate(monat, 1))
    if (!vorhanden.has(monat)) luecken.push(monat);
  return luecken;
};

/**
 * The overtime account (BAULISTE.md S-208): computed from the closed months, with the adjustments
 * by hand; nothing else is stored (docs/plan.md, "Konten": keine doppelte Wahrheit). In a month the
 * closing counts first, then its adjustments. `bis` stops at the end of a month.
 */
export const ueberstundenkonto = (
  abschluesse: readonly Abschluss[],
  anpassungen: readonly KontoAnpassung[] = [],
  bis?: Monat,
): KontoErgebnis => {
  if (!gueltig(abschluesse, anpassungen) || (bis !== undefined && !istMonat(bis)))
    return { ok: false, grund: "ungueltig" };
  const bisMonat = (eintrag: { monat: Monat }) => bis === undefined || eintrag.monat <= bis;
  const geschlossen = abschluesse.filter(bisMonat);
  const angepasst = anpassungen.filter(bisMonat);
  const monate = [...new Set([...geschlossen, ...angepasst].map((e) => e.monat))].sort();
  let saldo = 0;
  const verlauf = monate.map((monat): Kontomonat => {
    const abschluss = geschlossen.find((a) => a.monat === monat);
    const differenzMinuten = abschluss ? abschluss.istMinuten - abschluss.sollMinuten : 0;
    const anpassungMinuten = angepasst
      .filter((a) => a.monat === monat)
      .reduce((summe, a) => summe + wirkung(a), 0);
    saldo += differenzMinuten + anpassungMinuten;
    return { monat, differenzMinuten, anpassungMinuten, saldoMinuten: saldo };
  });
  const start = angepasst.find((anpassung) => anpassung.art === "startsaldo")?.monat;
  const luecken = lueckenZwischen(geschlossen.map((a) => a.monat).sort(), start);
  return { ok: true, wert: { saldoMinuten: saldo, verlauf, luecken } };
};

import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import { tagesstand } from "../heute/tagesstand.ts";
import { letzterTag, type Monat, monatVon, tageImMonat } from "../kalender/monat.ts";
import type { Tag } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";
import { buchungsMinuten } from "../projektzeit/buchung.ts";

/**
 * Utilisation (S-604): the stamped working time of a month against its booked project time, in
 * whole minutes. Per team always, per person only when the business switched it on (§ 87 Abs. 1
 * Nr. 6 BetrVG, docs/regeln.md R-30); which of the two is shown is the server's decision.
 */

/**
 * The smallest group the team view shows numbers for: with two, either person (and the owner who
 * knows one of them) reads the other's numbers off the sum (docs/plan.md, "Mindestgröße der
 * Auslastung je Team")
 */
export const MINDESTGROESSE = 3;

/** Stamped working time of one person on one working day */
export type Anwesenheit = { nutzerId: string; tag: Tag; minuten: number };

/** A booking as the utilisation needs it: whose, its working day, its span, billable or not */
export type AuslastungBuchung = {
  nutzerId: string;
  tag: Tag;
  beginn: number;
  ende: number | null;
  abrechenbar: boolean;
};

export type Auslastung = {
  /** stamped working time (§ 2 Abs. 1 ArbZG) */
  anwesendMinuten: number;
  /** booked on an order with an activity the business bills */
  abrechenbarMinuten: number;
  /** booked without an order or on an activity the business does not bill */
  internMinuten: number;
  /** stamped but not booked, never below zero per person */
  ohneBuchungMinuten: number;
  /** billable of stamped in whole percent; null without stamped time */
  abrechenbarProzent: number | null;
};

export type PersonAuslastung = Auslastung & { nutzerId: string };

export type TeamAuslastung =
  | ({ art: "team"; personen: number } & Auslastung)
  | { art: "zu_klein"; personen: number; mindestens: number };

/** A part of a whole in whole percent, rounded half up in integers; null without a whole */
export const anteilProzent = (teil: number, ganz: number): number | null =>
  ganz <= 0 ? null : Math.floor((teil * 200 + ganz) / (ganz * 2));

/** Whether a month has ended on `heute` (a day in Berlin) */
export const monatVorbei = (monat: Monat, heute: Tag): boolean => letzterTag(monat) < heute;

/**
 * The stamped working time of each working day of a month with any, as `tagesstand` counts it (a
 * shift running now up to now, a night shift on the day it starts). Pass the stamps from two days
 * before the month to two days after it.
 */
export const anwesenheitImMonat = (
  stempelungen: readonly Stempelung[],
  jetzt: number,
  monat: Monat,
): { tag: Tag; minuten: number }[] =>
  tageImMonat(monat).flatMap((tag) => {
    const stand = tagesstand(stempelungen, jetzt, tag);
    const minuten = stand.ok ? stand.wert.istMinuten : 0;
    return minuten > 0 ? [{ tag, minuten }] : [];
  });

type Summe = Pick<Auslastung, "anwesendMinuten" | "abrechenbarMinuten" | "internMinuten">;
const LEER: Summe = { anwesendMinuten: 0, abrechenbarMinuten: 0, internMinuten: 0 };

const mitAnteilen = (summe: Summe): Auslastung => ({
  ...summe,
  ohneBuchungMinuten: Math.max(
    0,
    summe.anwesendMinuten - summe.abrechenbarMinuten - summe.internMinuten,
  ),
  abrechenbarProzent: anteilProzent(summe.abrechenbarMinuten, summe.anwesendMinuten),
});

/**
 * The minutes a booking adds to its month: a running one up to now while the month runs, none once
 * it has ended, so two calls about an ended month give the same numbers (docs/plan.md, "Laufende
 * Buchung in der Auslastung")
 */
const gezaehlteMinuten = (buchung: AuslastungBuchung, monatLaeuft: boolean, jetzt: number) =>
  buchung.ende === null && !monatLaeuft ? 0 : buchungsMinuten(buchung.beginn, buchung.ende, jetzt);

/**
 * The month of each person with stamped or booked time in it, ordered by id so the order tells
 * nothing: only working days of the month count, a running booking up to now while the month runs
 */
export const auslastungJePerson = (angaben: {
  monat: Monat;
  jetzt: number;
  anwesenheit: readonly Anwesenheit[];
  buchungen: readonly AuslastungBuchung[];
}): PersonAuslastung[] => {
  const summen = new Map<string, Summe>();
  const addieren = (nutzerId: string, feld: keyof Summe, minuten: number) => {
    if (minuten <= 0) return;
    const bisher = summen.get(nutzerId) ?? LEER;
    summen.set(nutzerId, { ...bisher, [feld]: bisher[feld] + minuten });
  };
  for (const { nutzerId, tag, minuten } of angaben.anwesenheit)
    if (monatVon(tag) === angaben.monat) addieren(nutzerId, "anwesendMinuten", minuten);
  const monatLaeuft = !monatVorbei(angaben.monat, tagInBerlin(angaben.jetzt));
  for (const buchung of angaben.buchungen) {
    if (monatVon(buchung.tag) !== angaben.monat) continue;
    const minuten = gezaehlteMinuten(buchung, monatLaeuft, angaben.jetzt);
    addieren(
      buchung.nutzerId,
      buchung.abrechenbar ? "abrechenbarMinuten" : "internMinuten",
      minuten,
    );
  }
  return [...summen.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([nutzerId, summe]) => ({ nutzerId, ...mitAnteilen(summe) }));
};

/**
 * The month of a team: the sums of its people, or, for a group smaller than `mindestens`, no
 * numbers at all. The time without a booking is the sum per person, so one person's surplus of
 * bookings does not hide another's time without any.
 */
export const teamAuslastung = (
  personen: readonly PersonAuslastung[],
  mindestens = MINDESTGROESSE,
): TeamAuslastung => {
  if (personen.length < mindestens)
    return { art: "zu_klein", personen: personen.length, mindestens };
  const summe = personen.reduce<Summe>(
    (s, p) => ({
      anwesendMinuten: s.anwesendMinuten + p.anwesendMinuten,
      abrechenbarMinuten: s.abrechenbarMinuten + p.abrechenbarMinuten,
      internMinuten: s.internMinuten + p.internMinuten,
    }),
    LEER,
  );
  const ohneBuchungMinuten = personen.reduce((s, p) => s + p.ohneBuchungMinuten, 0);
  return { art: "team", personen: personen.length, ...mitAnteilen(summe), ohneBuchungMinuten };
};

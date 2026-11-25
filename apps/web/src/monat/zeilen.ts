import { type Monat, plusMonate, tageswerteDesInhalts, tagInBerlin } from "@soll/arbeitszeit";
import type { Aufzeichnung, Blattbefund } from "./typen.ts";

export type ZeilenAbwesenheit = NonNullable<Aufzeichnung["abwesenheiten"]>[number];

/** A row of the month's table: first and last stamp, break and work in whole minutes, findings */
export type Zeile = {
  tag: string;
  beginn: number | null;
  ende: number | null;
  pauseMinuten: number;
  arbeitsMinuten: number;
  sollMinuten: number | null;
  befunde: Blattbefund[];
  geaendert: boolean;
  /** the day's approved absences (S-401) */
  abwesenheiten: ZeilenAbwesenheit[];
  /** the call-outs of the day (S-505); `arbeitsMinuten` includes the ended ones */
  einsaetze: [number, number | null][];
  /** whether the day's Soll comes from the plan (S-505) */
  ausPlan: boolean;
};

/**
 * The rows of a month from its records, with the same functions as the server (S-201): a night
 * shift stays on the day it began, a shift still open has no end, a day with call-outs shows its
 * joined shift, as the Ist counts it (S-505)
 */
export const zeilenDesMonats = (
  tage: readonly Aufzeichnung[],
  befunde: readonly Blattbefund[],
  geaendert: readonly string[],
  jetzt: number,
): Zeile[] => {
  const zeitpunkte = tage.flatMap((tag) => tag.stempel.map(([, zeitpunkt]) => zeitpunkt));
  const werte = tageswerteDesInhalts(tage, Math.max(jetzt, ...zeitpunkte));
  return tage.map((aufzeichnung) => {
    const einsaetze = aufzeichnung.einsaetze ?? [];
    return {
      tag: aufzeichnung.tag,
      ...werte(aufzeichnung),
      sollMinuten: aufzeichnung.planMinuten ?? aufzeichnung.modellMinuten,
      einsaetze,
      ausPlan: aufzeichnung.planMinuten !== undefined,
      befunde: befunde.filter((befund) => befund.tage.includes(aufzeichnung.tag)),
      geaendert: geaendert.includes(aufzeichnung.tag),
      abwesenheiten: aufzeichnung.abwesenheiten ?? [],
    };
  });
};

/** The month to show first: the one before the running month, the one a person closes next */
export const vormonat = (jetzt: number): Monat => plusMonate(tagInBerlin(jetzt).slice(0, 7), -1);

/** Whole minutes with a sign, for the balance: "+3:28", "-0:15" */
export const saldoText = (minuten: number): string => {
  const betrag = Math.abs(minuten);
  const text = `${Math.floor(betrag / 60)}:${String(betrag % 60).padStart(2, "0")}`;
  return minuten < 0 ? `-${text}` : `+${text}`;
};

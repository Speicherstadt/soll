import {
  arbeitstage,
  type Monat,
  plusMonate,
  type Stempelung,
  tagInBerlin,
} from "@soll/arbeitszeit";
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
};

/**
 * The rows of a month from its records, with the same functions as the server (S-201): a night
 * shift stays on the day it began, a shift still open has no end
 */
export const zeilenDesMonats = (
  tage: readonly Aufzeichnung[],
  befunde: readonly Blattbefund[],
  geaendert: readonly string[],
  jetzt: number,
): Zeile[] => {
  const stempel: Stempelung[] = tage.flatMap((tag) =>
    tag.stempel.map(([art, zeitpunkt]) => ({ art, zeitpunkt })),
  );
  const ergebnis = arbeitstage(stempel, Math.max(jetzt, ...stempel.map((s) => s.zeitpunkt)));
  const arbeit = new Map((ergebnis.ok ? ergebnis.wert : []).map((tag) => [tag.tag, tag]));
  return tage.map((aufzeichnung) => {
    const tag = arbeit.get(aufzeichnung.tag);
    return {
      tag: aufzeichnung.tag,
      beginn: tag?.beginn ?? null,
      ende: tag?.ende ?? null,
      pauseMinuten: tag?.pausenMinuten ?? 0,
      arbeitsMinuten: tag?.arbeitsMinuten ?? 0,
      sollMinuten: aufzeichnung.modellMinuten,
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

/** Tone for a balance: positive is success, zero or negative flextime stays neutral (never danger) */
export const saldoTon = (minuten: number): "default" | "success" =>
  minuten > 0 ? "success" : "default";

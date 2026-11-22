import {
  type Monat,
  minutenAmWochentag,
  type Stempelart,
  type Tag,
  tageImMonat,
} from "@soll/arbeitszeit";
import type { LohnAufzeichnung, Lohnmodell } from "./lohnmonat.ts";

/*
 * Test data of S-308: Weber Haustechnik and Café Elbblick in Hamburg (CLAUDE.md, "Test data"). A
 * shift is written with its UTC offset, so every case says which side of a DST change it is on.
 */

export const HAMBURG = { land: "HH" } as const;

const MO_FR = [480, 480, 480, 480, 480, 0, 0] as const;
const NACH_PLAN = [0, 0, 0, 0, 0, 0, 0] as const;

export const stundenModell = (cent: number, mehr: Partial<Lohnmodell> = {}): Lohnmodell => ({
  ab: "2026-01-01",
  sollMinuten: MO_FR,
  lohnArt: "stunde",
  lohnCent: cent,
  minijob: false,
  zuschlagssaetze: {},
  ...mehr,
});

export const minijobModell = (cent: number, mehr: Partial<Lohnmodell> = {}): Lohnmodell =>
  stundenModell(cent, { sollMinuten: NACH_PLAN, minijob: true, ...mehr });

export const monatsModell = (cent: number, mehr: Partial<Lohnmodell> = {}): Lohnmodell =>
  stundenModell(cent, { lohnArt: "monat", ...mehr });

/** A shift on a day: "08:00", "16:30" with the offset of the day, an optional break */
export type Schicht = { tag: Tag; von: string; bis: string; pause?: [string, string] };

const zeit = (iso: string) => Date.parse(iso);

/** The stamps of a shift: Kommen, Pause, Pause-Ende, Gehen; `bis` before `von` ends the next day */
const stempelVon = (s: Schicht, offset: string): [Stempelart, number][] => {
  const am = (uhr: string, tag = s.tag) => zeit(`${tag}T${uhr}:00${offset}`);
  const kommen = am(s.von);
  let gehen = am(s.bis);
  if (gehen <= kommen) gehen += 24 * 3_600_000;
  const pause: [Stempelart, number][] = s.pause
    ? [
        ["pause_beginn", am(s.pause[0])],
        ["pause_ende", am(s.pause[1])],
      ]
    : [];
  return [["kommen", kommen], ...pause, ["gehen", gehen]];
};

/**
 * Every day of a month as it was closed: the stamps of the shifts on it and the minutes of the
 * model. `offset` is the UTC offset of the month's days ("+01:00" in winter, "+02:00" in summer).
 */
export const monatsTage = (
  monat: Monat,
  sollMinuten: readonly number[],
  schichten: readonly Schicht[],
  offset: string,
): LohnAufzeichnung[] =>
  tageImMonat(monat).map((tag) => ({
    tag,
    stempel: schichten.filter((s) => s.tag === tag).flatMap((s) => stempelVon(s, offset)),
    modellMinuten: minutenAmWochentag(sollMinuten, tag),
  }));

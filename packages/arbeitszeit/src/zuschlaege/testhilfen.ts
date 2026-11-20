import { expect } from "vitest";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import type { Standort } from "../feiertage/laender.ts";
import { tage } from "../pruefung/testhilfen.ts";
import type { PruefTag } from "../pruefung/typen.ts";
import type { Grundlohn } from "./grundlohn.ts";
import type { Zuschlagssaetze } from "./saetze.ts";
import { type ZuschlagOptionen, type Zuschlagstag, zuschlaege } from "./zuschlaege.ts";

/*
 * Helpers for the tests of § 3b EStG. Wall-clock times carry their UTC offset, as in the tests of the
 * working day, so every DST case states which side of the change it is on.
 */
export { schicht, tage } from "../pruefung/testhilfen.ts";

export const HAMBURG: Standort = { land: "HH" };
export const BRANDENBURG: Standort = { land: "BB" };

export const stundenlohn = (cent: number): Grundlohn => ({ art: "stunde", cent });

/** The surcharges of stamps or of working days, computed with the options; fails on "ungueltig" */
export const rechne = (
  arbeit: readonly Stempelung[] | readonly PruefTag[],
  grundlohn: Grundlohn,
  saetze: Zuschlagssaetze,
  standort: Standort = HAMBURG,
): { tage: Zuschlagstag[]; nichtHinterlegt: string[] } => {
  const istStempelung = (eintrag: Stempelung | PruefTag): eintrag is Stempelung => "art" in eintrag;
  const liste = arbeit.every(istStempelung) ? tage([...arbeit]) : (arbeit as readonly PruefTag[]);
  const optionen: ZuschlagOptionen = { grundlohn, saetze, standort };
  const ergebnis = zuschlaege(liste, optionen);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

/** The only working day of a calculation */
export const einTag = (ergebnis: { tage: Zuschlagstag[] }): Zuschlagstag => {
  expect(ergebnis.tage).toHaveLength(1);
  return ergebnis.tage[0] as Zuschlagstag;
};

const uhr = (ms: number) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ms);

/**
 * The stretches of a day as "von–bis: tax-free %" (night + day) with their minutes, the way the cases
 * in docs/regeln.md read
 */
export const saetzeVon = (tag: Zuschlagstag) =>
  tag.abschnitte.map((a) => ({
    von: uhr(a.beginn),
    bis: uhr(a.ende),
    minuten: a.minuten,
    steuerfreiProzent: (a.steuerfrei.nacht + a.steuerfrei.tag) / 100,
  }));

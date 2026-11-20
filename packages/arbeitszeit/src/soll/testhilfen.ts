import { feiertagAm } from "../feiertage/feiertage.ts";
import type { Standort } from "../feiertage/laender.ts";
import { type Monat, tageImMonat } from "../kalender/monat.ts";
import { plusTage, type Tag, tageZwischen, wochentag } from "../kalender/tag.ts";
import { tagMit } from "../pruefung/testhilfen.ts";
import type { PruefTag } from "../pruefung/typen.ts";
import type { MonatsEingaben } from "./monat.ts";
import type { Abwesenheit, Abwesenheitsart, Modellabschnitt } from "./typen.ts";

/*
 * Helpers for the tests of Soll and Ist: Weber Haustechnik in Hamburg (CLAUDE.md, test data), Sandra
 * on Mo–Fr 8:00 unless a case says otherwise.
 */
export const HAMBURG: Standort = { land: "HH" };

export const MO_FR_8: readonly number[] = [480, 480, 480, 480, 480, 0, 0];

export const modell = (
  ab: Tag,
  sollMinuten: readonly number[] = MO_FR_8,
  weiteres: Partial<Modellabschnitt> = {},
): Modellabschnitt => ({ ab, sollMinuten, ...weiteres });

export const SANDRA: MonatsEingaben = {
  modelle: [modell("2026-01-01")],
  standort: HAMBURG,
  beschaeftigung: { eintritt: "2024-04-01" },
};

/** Monday to Friday of a month without the holidays in Hamburg and the days named */
export const werktageMoFr = (monat: Monat, ausser: readonly Tag[] = []): Tag[] =>
  tageImMonat(monat).filter((tag) => {
    const feiertag = feiertagAm(tag, HAMBURG);
    const frei = feiertag.ok && feiertag.feiertag !== null;
    return wochentag(tag) >= 1 && wochentag(tag) <= 5 && !frei && !ausser.includes(tag);
  });

/** A working day of `minuten` on each of the days */
export const gearbeitet = (tage: readonly Tag[], minuten: number): PruefTag[] =>
  tage.map((tag) => tagMit(tag, minuten));

/** The days from `von` through `bis` */
export const tageVonBis = (von: Tag, bis: Tag): Tag[] =>
  Array.from({ length: tageZwischen(von, bis) + 1 }, (_, index) => plusTage(von, index));

/** An absence of one kind on each of the days */
export const abwesend = (
  art: Abwesenheitsart,
  tage: readonly Tag[],
  weiteres: Partial<Abwesenheit> = {},
): Abwesenheit[] => tage.map((tag) => ({ tag, art, ...weiteres }));

/** h:mm as minutes, "−10:30" negative */
export const hm = (text: string): number => {
  const negativ = text.startsWith("−") || text.startsWith("-");
  const [stunden = 0, minuten = 0] = text.replace(/^[−-]/, "").split(":").map(Number);
  return (negativ ? -1 : 1) * (stunden * 60 + minuten);
};

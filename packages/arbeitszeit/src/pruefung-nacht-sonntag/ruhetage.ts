import type { Stueck } from "../arbeitstag/schichten.ts";
import { type Feiertag, feiertagAm } from "../feiertage/feiertage.ts";
import type { Standort } from "../feiertage/laender.ts";
import { plusTage, type Tag, wochentag } from "../kalender/tag.ts";
import { tagInBerlin, zeitpunktInBerlin } from "../kalender/zeit.ts";
import { arbeitsbloecke, gemeinsameMinuten, MINUTE, type PruefTag } from "./typen.ts";

/** A Sunday or a legal holiday at the place of work (§ 9 Abs. 1 ArbZG) */
export type Ruhetag = { tag: Tag; sonntag: boolean; feiertag: Feiertag | null };

/**
 * The Sunday or holiday on a day at a place, null on a Werktag (every other day, Saturday included);
 * "nicht hinterlegt" when the holidays of its year are not known (S-105)
 */
export const ruhetagAm = (
  tag: Tag,
  standort: Standort,
): { ok: true; ruhetag: Ruhetag | null } | { ok: false } => {
  const feiertag = feiertagAm(tag, standort);
  if (!feiertag.ok) return { ok: false };
  const sonntag = wochentag(tag) === 0;
  if (!sonntag && feiertag.feiertag === null) return { ok: true, ruhetag: null };
  return { ok: true, ruhetag: { tag, sonntag, feiertag: feiertag.feiertag } };
};

/** A wall-clock time `minuten` from 0:00 of `tag`, also before it (negative) */
const uhrzeit = (tag: Tag, minuten: number): number =>
  minuten < 0
    ? zeitpunktInBerlin(plusTage(tag, -1), 24 * 60 + minuten)
    : zeitpunktInBerlin(tag, minuten);

const RUHE_VERSCHOBEN = 24 * 60;

/**
 * The rest of a Sunday or holiday: from 0 to 24 Uhr (§ 9 Abs. 1 ArbZG), wall-clock times, so the
 * day of a DST change has 23 or 25 hours. In a business with regular day and night shifts its
 * beginning and end may be moved by up to six hours (§ 9 Abs. 2 ArbZG, `verschiebung` in minutes,
 * negative = earlier), „wenn für die auf den Beginn der Ruhezeit folgenden 24 Stunden der Betrieb
 * ruht“: the moved rest lasts at least 24 real hours (23 on the clock in March are not enough),
 * and keeps the 25 of October, whose end may not move more than six hours either.
 */
export const ruhezeitraum = (tag: Tag, verschiebung: number): Stueck => {
  const beginn = uhrzeit(tag, verschiebung);
  const verschobenesEnde = uhrzeit(plusTage(tag, 1), verschiebung);
  const ende =
    verschiebung === 0
      ? verschobenesEnde
      : Math.max(verschobenesEnde, beginn + RUHE_VERSCHOBEN * MINUTE);
  return { beginn, ende, minuten: (ende - beginn) / MINUTE };
};

/** A Sunday or holiday with the minutes worked in its rest */
export type RuhetagMitArbeit = Ruhetag & { minuten: number };

/** The days a span may touch: from the day before its first day to the day after its last */
const tageUm = (stueck: Stueck): Tag[] => {
  const tage: Tag[] = [];
  const letzter = plusTage(tagInBerlin(stueck.ende), 1);
  for (let tag = plusTage(tagInBerlin(stueck.beginn), -1); tag <= letzter; tag = plusTage(tag, 1))
    tage.push(tag);
  return tage;
};

/**
 * The Sundays and holidays on which the closed shifts of the days have work, with its minutes, in
 * calendar order, each rest moved as `verschiebungAm` says; and the days whose holidays are not known
 */
export const arbeitAnRuhetagen = (
  tage: readonly PruefTag[],
  standort: Standort,
  verschiebungAm: (tag: Tag) => number,
): { ruhetage: RuhetagMitArbeit[]; nichtHinterlegt: Tag[] } => {
  const minuten = new Map<Tag, RuhetagMitArbeit>();
  const nichtHinterlegt = new Set<Tag>();
  for (const block of arbeitsbloecke(tage))
    for (const tag of tageUm(block)) {
      const anteil = gemeinsameMinuten(block, ruhezeitraum(tag, verschiebungAm(tag)));
      if (anteil === 0) continue;
      const ruhetag = ruhetagAm(tag, standort);
      if (!ruhetag.ok) nichtHinterlegt.add(tag);
      else if (ruhetag.ruhetag !== null) {
        const bisher = minuten.get(tag)?.minuten ?? 0;
        minuten.set(tag, { ...ruhetag.ruhetag, minuten: bisher + anteil });
      }
    }
  return {
    ruhetage: [...minuten.values()].sort((a, b) => a.tag.localeCompare(b.tag)),
    nichtHinterlegt: [...nichtHinterlegt].sort(),
  };
};

/**
 * The calendar days 0 to 24 Uhr on which the closed shifts of the days have any work, and the first
 * day of an open shift: its end is not known (R-01), so its day is not free
 */
export const kalendertageMitArbeit = (tage: readonly PruefTag[]): Set<Tag> => {
  const ergebnis = new Set<Tag>(
    tage.flatMap((tag) =>
      tag.schichten.filter((schicht) => schicht.ende === null).map(() => tag.tag),
    ),
  );
  for (const block of arbeitsbloecke(tage)) {
    const letzter = tagInBerlin(block.ende - 1);
    for (let tag = tagInBerlin(block.beginn); tag <= letzter; tag = plusTage(tag, 1))
      ergebnis.add(tag);
  }
  return ergebnis;
};

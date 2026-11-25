import { istTag } from "@soll/arbeitszeit";

/*
 * The values of an export as German tools and Excel write them: days in ISO or as `01.09.2026`,
 * times of day as `7:00`, durations as minutes or `0:30`. A value that is not one of these is null,
 * never a guess: the reader names its line instead (BAULISTE.md S-701).
 */

const zwei = (text: string): string => text.padStart(2, "0");

/** A calendar day `YYYY-MM-DD`, from `2026-09-01` or `1.9.2026` */
export const datumLesen = (text: string): string | null => {
  const wert = text.trim();
  const deutsch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(wert);
  const tag = deutsch ? `${deutsch[3]}-${zwei(deutsch[2] ?? "")}-${zwei(deutsch[1] ?? "")}` : wert;
  return istTag(tag) ? tag : null;
};

/** Minutes since midnight of a time of day `H:MM`, 0:00 to 23:59 */
export const uhrzeitLesen = (text: string): number | null => {
  const teile = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!teile) return null;
  const stunden = Number(teile[1]);
  const minuten = Number(teile[2]);
  return stunden < 24 && minuten < 60 ? stunden * 60 + minuten : null;
};

/** The longest break or duration a field may hold: one day */
const MAX_MINUTEN = 24 * 60;

/** Whole minutes from `30` or `0:30`; an empty field is none */
export const minutenLesen = (text: string): number | null => {
  const wert = text.trim();
  if (wert === "") return 0;
  const zahl = /^\d{1,5}$/.test(wert) ? Number(wert) : null;
  const teile = /^(\d{1,2}):(\d{2})$/.exec(wert);
  const minuten =
    zahl ?? (teile && Number(teile[2]) < 60 ? Number(teile[1]) * 60 + Number(teile[2]) : null);
  return minuten !== null && minuten <= MAX_MINUTEN ? minuten : null;
};

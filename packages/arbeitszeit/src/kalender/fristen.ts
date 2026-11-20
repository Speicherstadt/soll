import { letzterTag, monatVon, plusMonate } from "./monat.ts";
import { plusTage, type Tag } from "./tag.ts";

/**
 * The last day of a period of `monate` months that begins with the whole day `beginn`, as the BGB
 * counts it: the day of the start counts (§ 187 Abs. 2 Satz 1), so the period ends with the day
 * before the day of the same number in the last month (§ 188 Abs. 2); a month without that day ends
 * the period on its last day (§ 188 Abs. 3). 1.8. and five months end on 31.12., 31.1. and one month
 * on the last day of February.
 */
export const monatsfristEnde = (beginn: Tag, monate: number): Tag => {
  const zielmonat = plusMonate(monatVon(beginn), monate);
  const gleicherTag = `${zielmonat}-${beginn.slice(8)}`;
  return gleicherTag <= letzterTag(zielmonat) ? plusTage(gleicherTag, -1) : letzterTag(zielmonat);
};

/**
 * The full months from `von` through `bis`, both days included: months counted from the first day
 * (§ 5 Abs. 1 BUrlG, § 208 Abs. 2 SGB IX: „voller Monat des Bestehens des Arbeitsverhältnisses“),
 * not calendar months; 0 when `bis` lies before `von`
 */
export const volleMonate = (von: Tag, bis: Tag): number => {
  let anzahl = 0;
  while (monatsfristEnde(von, anzahl + 1) <= bis) anzahl += 1;
  return anzahl;
};

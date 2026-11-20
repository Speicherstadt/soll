import type { Befund } from "../befund.ts";
import type { Tag } from "../kalender/tag.ts";
import { arbeitstageJeWoche } from "../soll/modell.ts";
import type { Modellabschnitt } from "../soll/typen.ts";

/**
 * § 3 Abs. 1 BUrlG: 24 Werktage at six working days a week, `24 × Arbeitstage je Woche ÷ 6` at
 * fewer or more (docs/regeln.md, R-23), in half days: four days per weekly working day
 */
export const gesetzlicherUrlaub = (arbeitstage: number): number => 8 * arbeitstage;

/**
 * § 208 Abs. 1 Satz 1 SGB IX: five working days at five a week, „entsprechend mehr oder weniger“:
 * one working week, in half days
 */
export const gesetzlicherZusatzurlaub = (arbeitstage: number): number => 2 * arbeitstage;

/** R-23: the leave a model gives is under the statutory minimum (a Hinweis at the model) */
export type MindesturlaubBefund = Befund<"unter_mindesturlaub"> & {
  urlaubHalbtage: number;
  mindestHalbtage: number;
};

/**
 * The model's leave against the statutory minimum (§ 3 Abs. 1 BUrlG). Below it the minimum applies
 * all the same (§ 13 Abs. 1 Satz 1 BUrlG); a model without leave of its own gives the minimum.
 * `tag` is the day the finding names, the model's start by default.
 */
export const mindesturlaub = (
  modell: Modellabschnitt,
  tag: Tag = modell.ab,
): MindesturlaubBefund | null => {
  const mindestHalbtage = gesetzlicherUrlaub(arbeitstageJeWoche(modell));
  if (modell.urlaubHalbtage == null || modell.urlaubHalbtage >= mindestHalbtage) return null;
  return {
    regel: "R-23",
    norm: "§ 3 Abs. 1 BUrlG",
    schwere: "hinweis",
    art: "unter_mindesturlaub",
    tage: [tag],
    urlaubHalbtage: modell.urlaubHalbtage,
    mindestHalbtage,
  };
};

import { istTag, jahrVon, type Tag } from "../kalender/tag.ts";
import type { Halbtage } from "./halbtage.ts";
import type { UrlaubskontoEingaben } from "./verfall.ts";

/**
 * The leave open on a cut-off date as the old tool showed it (S-708, docs/regeln.md R-34): all
 * leave open that day, the leave of its year included. `tag` is the first day of a month.
 */
export type UrlaubStichtag = { tag: Tag; halbtage: Halbtage };

export type StichtagErgebnis =
  | { ok: true; wert: UrlaubskontoEingaben }
  | { ok: false; grund: "ungueltig" };

/** The first day of a month, as Soll counts accounts by months */
export const istStichtag = (tag: string): boolean => istTag(tag) && tag.endsWith("-01");

/**
 * The inputs of the leave account from a cut-off date (R-34): the leave open that day replaces the
 * leave of its year, as the old tool already took off what was taken before; leave before the day
 * counts no more, and a notice before it names leave the account does not hold. Carried-over leave
 * of the year before joins the year of the cut-off date and so expires at the earliest on 31 March
 * of the next year, and only after a notice (§ 7 Abs. 3 BUrlG; EuGH C-684/16): never silently, the
 * reading better for the person. Never negative: leave granted beyond the entitlement is not
 * claimed back (§ 5 Abs. 3 BUrlG).
 */
export const urlaubAbStichtag = (
  eingaben: UrlaubskontoEingaben,
  stichtag: UrlaubStichtag,
): StichtagErgebnis => {
  if (
    !istStichtag(stichtag.tag) ||
    !Number.isSafeInteger(stichtag.halbtage) ||
    stichtag.halbtage < 0
  )
    return { ok: false, grund: "ungueltig" };
  const jahr = jahrVon(stichtag.tag);
  const jahre = eingaben.jahre.filter((j) => j.jahr >= jahr);
  if (!jahre.some((j) => j.jahr === jahr)) return { ok: false, grund: "ungueltig" };
  return {
    ok: true,
    wert: {
      ...eingaben,
      jahre: jahre.map((j) =>
        j.jahr === jahr ? { ...j, anspruchHalbtage: stichtag.halbtage } : j,
      ),
      genommen: eingaben.genommen.filter((g) => g.tag >= stichtag.tag),
      hinweise: (eingaben.hinweise ?? []).filter((tag) => tag >= stichtag.tag),
    },
  };
};

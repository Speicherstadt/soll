import { istTag, jahrVon, type Tag } from "../kalender/tag.ts";
import type { Halbtage } from "./halbtage.ts";
import { type UrlaubskontoEingaben, urlaubskonto } from "./verfall.ts";

/** One line of a notice: the leave of a year open on its day and when it expires */
export type HinweisPosten = { jahr: number; halbtage: Halbtage; verfaelltAm: Tag };

export type HinweisErgebnis =
  | { ok: true; wert: HinweisPosten[] }
  | { ok: false; grund: "ungueltig" };

/**
 * What a notice on leave expiring given on `tag` names (BAULISTE.md S-402): all leave open on that
 * day, per year, and the day it expires at the end of once the notice is given; a year an earlier
 * notice already named keeps the day that one set (§ 7 Abs. 3 BUrlG; EuGH C-684/16 Max-Planck; BAG,
 * 19.02.2019, 9 AZR 541/15 and 9 AZR 423/16: the notice must be concrete, naming the days and the
 * deadline). Leave of a year after the notice is not named. The account is the one of that day.
 */
export const verfallHinweis = (e: UrlaubskontoEingaben, tag: Tag): HinweisErgebnis => {
  if (!istTag(tag)) return { ok: false, grund: "ungueltig" };
  const konto = urlaubskonto({
    ...e,
    hinweise: [...(e.hinweise ?? []).filter((frueher) => frueher < tag), tag],
    heute: tag,
  });
  if (!konto.ok) return konto;
  return {
    ok: true,
    wert: konto.wert.toepfe
      .filter((topf) => topf.restHalbtage > 0 && topf.jahr <= jahrVon(tag))
      .map((topf) => ({
        jahr: topf.jahr,
        halbtage: topf.restHalbtage,
        // the notice of `tag` names every year up to its own, so each has a day to expire
        verfaelltAm: topf.verfaelltAm as Tag,
      })),
  };
};

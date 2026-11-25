import { jahrVon, type Tag } from "../kalender/tag.ts";
import type { GenommenerUrlaub, UrlaubskontoEingaben, Urlaubstopf } from "./verfall.ts";

/*
 * Taking and expiring leave in the order of days (R-23, review S-708). A notice lets expire on its
 * day of expiry only the leave it named that is still open: what it named less what was taken from
 * that year after it (EuGH C-684/16 Max-Planck; BAG, 19.02.2019, 9 AZR 541/15: the notice must be
 * concrete). Leave it did not name, added later by a correction, stays until a notice names it.
 */

const jahrText = (jahr: number): string => String(jahr).padStart(4, "0");

/**
 * The day a notice given on `tag` lets the leave of a pot expire at the end of: in time (by
 * `hinweisBis`), the regular day; later, 31 March after the year of the notice (BAG, 19.02.2019,
 * 9 AZR 423/16)
 */
export const verfallNachHinweis = (
  topf: Pick<Urlaubstopf, "verfallstag" | "hinweisBis">,
  tag: Tag,
): Tag => (tag <= topf.hinweisBis ? topf.verfallstag : `${jahrText(jahrVon(tag) + 1)}-03-31`);

/** A notice for a pot: its day, the day it lets expire at the end of, the half days it named */
type Benennung = { tag: Tag; ablauf: Tag; halbtage: number };

/**
 * The notices that name a pot. With named amounts, those naming its year; without, every notice
 * from the year of the pot on names all of it (S-402).
 */
const benennungenVon = (e: UrlaubskontoEingaben, topf: Urlaubstopf): Benennung[] => {
  if (e.benannt === undefined)
    return (e.hinweise ?? [])
      .filter((tag) => tag <= e.heute && jahrVon(tag) >= topf.jahr)
      .map((tag) => ({
        tag,
        ablauf: verfallNachHinweis(topf, tag),
        halbtage: Number.MAX_SAFE_INTEGER,
      }));
  return e.benannt
    .filter((h) => h.tag <= e.heute)
    .flatMap((h) =>
      h.posten
        .filter((p) => p.jahr === topf.jahr && p.halbtage > 0)
        .map((p) => ({
          tag: h.tag,
          ablauf: verfallNachHinweis(topf, h.tag),
          halbtage: p.halbtage,
        })),
    );
};

/** What happened to a pot's expiry: the last day leave of it expired, and the next day it may */
export type Ablaufstand = {
  /** the last day at whose end leave of the pot expired */
  verfallenAm: Tag | null;
  /** the next day at whose end leave of the pot may expire */
  naechster: Tag | null;
  /** the last such day that passed, whether leave expired then or not */
  zuletzt: Tag | null;
  /**
   * every day still to come at whose end leave of the pot expires if nothing else changes, with
   * the half days then: the same day-by-day expiry run on to the last such day (review S-708)
   */
  drohend: { tag: Tag; halbtage: number }[];
};

type Lauf = {
  topf: Urlaubstopf;
  benennungen: Benennung[];
  /** the days still to come at which leave of the pot may expire, in order */
  offen: Tag[];
  /** the leave taken from the pot, by day */
  entnommen: GenommenerUrlaub[];
  verfallenAm: Tag | null;
  zuletzt: Tag | null;
};

/**
 * The half days that expire at the end of `ablauf` as the pot stands now: the last notice that lets
 * the pot expire then governs, what it named less what was taken from the pot after it, as far as
 * still open
 */
const faellig = (lauf: Lauf, ablauf: Tag): number => {
  const fuer = lauf.benennungen
    .filter((b) => b.ablauf === ablauf)
    .sort((a, b) => a.tag.localeCompare(b.tag));
  const letzte = fuer.at(-1);
  if (letzte === undefined || lauf.topf.restHalbtage <= 0) return 0;
  const danach = lauf.entnommen
    .filter((g) => g.tag > letzte.tag)
    .reduce((summe, g) => summe + g.halbtage, 0);
  return Math.min(lauf.topf.restHalbtage, Math.max(0, letzte.halbtage - danach));
};

/** Lets expire at the end of `ablauf` what is due then */
const verfallen = (lauf: Lauf, ablauf: Tag) => {
  const teil = faellig(lauf, ablauf);
  if (teil <= 0) return;
  lauf.topf.restHalbtage -= teil;
  lauf.topf.verfallenHalbtage += teil;
  lauf.verfallenAm = ablauf;
};

/** Lets expire what is due at the end of every day before `tag` */
const bis = (laeufe: readonly Lauf[], tag: Tag) => {
  for (const lauf of laeufe)
    while (lauf.offen.length > 0 && (lauf.offen[0] as Tag) < tag) {
      const ablauf = lauf.offen.shift() as Tag;
      verfallen(lauf, ablauf);
      lauf.zuletzt = ablauf;
    }
};

/**
 * What would expire on each day still to come, if nothing else changes: the same expiry run on a
 * copy of the pot, so the findings and the expiry agree by construction
 */
const vorausrechnen = (lauf: Lauf): { tag: Tag; halbtage: number }[] => {
  const kopie: Lauf = { ...lauf, topf: { ...lauf.topf }, offen: [...lauf.offen] };
  return lauf.offen.flatMap((ablauf) => {
    const vorher = kopie.topf.verfallenHalbtage;
    verfallen(kopie, ablauf);
    const halbtage = kopie.topf.verfallenHalbtage - vorher;
    return halbtage > 0 ? [{ tag: ablauf, halbtage }] : [];
  });
};

/**
 * Takes one day of leave off the pots in the order of years: the oldest first, as it expires first
 * and the person keeps the most (docs/plan.md, "Verfall von Urlaub"); beyond its own year's leave it
 * counts against the following years, as leave granted in advance (R-23, § 7 Abs. 3 BUrlG: only
 * leave still open can expire). Leave beyond every year Soll knows stays in its own year, below
 * zero, until the entitlement of the next year is known.
 */
const entnehmen = (laeufe: readonly Lauf[], eintrag: GenommenerUrlaub) => {
  let offen = eintrag.halbtage;
  for (const lauf of laeufe) {
    const { topf } = lauf;
    if (offen === 0 || topf.restHalbtage <= 0) continue;
    const teil = Math.min(offen, topf.restHalbtage);
    topf.restHalbtage -= teil;
    topf.genommenHalbtage += teil;
    lauf.entnommen.push({ tag: eintrag.tag, halbtage: teil });
    offen -= teil;
  }
  const eigener = laeufe.find((lauf) => lauf.topf.jahr === jahrVon(eintrag.tag));
  if (offen > 0 && eigener !== undefined) {
    eigener.topf.restHalbtage -= offen;
    eigener.topf.genommenHalbtage += offen;
    eigener.entnommen.push({ tag: eintrag.tag, halbtage: offen });
  }
};

/** Before every day: an offset of a year's leave below zero is no leave taken on a day */
const VOR_ALLEM: Tag = "0000-01-01";

/**
 * A year whose leave a correction put below zero (an advance the old tool granted, `urlaub_korrektur`
 * below zero) counts against the leave of the other years like leave taken in advance, the oldest
 * first: so the account and a notice name only leave that is open (§ 7 Abs. 3 BUrlG; EuGH C-684/16).
 * What no other year covers stays below zero in its own year. The year keeps its own entitlement
 * raised by what was offset, the others count it as taken before every day.
 */
const ausgleichen = (laeufe: readonly Lauf[]) => {
  for (const lauf of laeufe) {
    let fehlt = -lauf.topf.restHalbtage;
    for (const andere of laeufe) {
      if (fehlt <= 0) break;
      if (andere === lauf || andere.topf.restHalbtage <= 0) continue;
      const teil = Math.min(fehlt, andere.topf.restHalbtage);
      andere.topf.restHalbtage -= teil;
      andere.topf.genommenHalbtage += teil;
      andere.entnommen.push({ tag: VOR_ALLEM, halbtage: teil });
      lauf.topf.anspruchHalbtage += teil;
      lauf.topf.restHalbtage += teil;
      fehlt -= teil;
    }
  }
};

/**
 * Takes the leave up to `heute` off the pots and lets expire what notices named, day by day; sets
 * each pot's first notice and returns per year when it expired and when it may next
 */
export const ablaufen = (
  e: UrlaubskontoEingaben,
  toepfe: Urlaubstopf[],
): Map<number, Ablaufstand> => {
  const laeufe: Lauf[] = toepfe.map((topf) => {
    const benennungen = benennungenVon(e, topf);
    topf.hinweis = benennungen.map((b) => b.tag).sort()[0] ?? null;
    return {
      topf,
      benennungen,
      offen: [...new Set(benennungen.map((b) => b.ablauf))].sort(),
      entnommen: [],
      verfallenAm: null,
      zuletzt: null,
    };
  });
  ausgleichen(laeufe);
  const genommen = e.genommen
    .filter((g) => g.tag <= e.heute)
    .sort((a, b) => a.tag.localeCompare(b.tag));
  for (const eintrag of genommen) {
    bis(laeufe, eintrag.tag);
    entnehmen(laeufe, eintrag);
  }
  bis(laeufe, e.heute);
  return new Map(
    laeufe.map((lauf) => [
      lauf.topf.jahr,
      {
        verfallenAm: lauf.verfallenAm,
        naechster: lauf.offen[0] ?? null,
        zuletzt: lauf.zuletzt,
        drohend: vorausrechnen(lauf),
      },
    ]),
  );
};

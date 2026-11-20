import type { Befund } from "../befund.ts";
import { istTag, jahrVon, type Tag } from "../kalender/tag.ts";
import type { Halbtage } from "./halbtage.ts";

/**
 * The leave of one year as `urlaubsanspruch` gave it. `teilurlaubA`: Teilurlaub under § 5 Abs. 1
 * Buchst. a BUrlG, which the person may ask to carry over into the whole next year
 * (`uebertragungVerlangt`, § 7 Abs. 3 Satz 4 BUrlG).
 */
export type Urlaubsjahr = {
  jahr: number;
  anspruchHalbtage: Halbtage;
  teilurlaubA?: boolean;
  uebertragungVerlangt?: boolean;
};

/** Leave taken or granted for a day, in half days (from `tagesSoll`) */
export type GenommenerUrlaub = { tag: Tag; halbtage: Halbtage };

/** Leave of a year changed by hand: a remainder brought from before Soll, a correction (signed) */
export type Urlaubsanpassung = { jahr: number; halbtage: Halbtage };

export type UrlaubskontoEingaben = {
  jahre: readonly Urlaubsjahr[];
  genommen: readonly GenommenerUrlaub[];
  anpassungen?: readonly Urlaubsanpassung[];
  /**
   * The days the business told the person which leave is open and when it expires (BAG,
   * 19.02.2019, 9 AZR 423/16; EuGH C-684/16). A notice names all leave open on its day.
   */
  hinweise?: readonly Tag[];
  heute: Tag;
};

export type Urlaubstopf = {
  jahr: number;
  anspruchHalbtage: Halbtage;
  genommenHalbtage: Halbtage;
  verfallenHalbtage: Halbtage;
  restHalbtage: Halbtage;
  /** the day the leave expires at the end of if the notice comes in time: 31.3. or 31.12. next year */
  verfallstag: Tag;
  /** the last day for that notice */
  hinweisBis: Tag;
  /** the first notice that names this leave */
  hinweis: Tag | null;
  /** the day the leave expires at the end of; null while no notice names it: it does not expire */
  verfaelltAm: Tag | null;
};

/**
 * R-23, § 7 Abs. 3 BUrlG: the notice is due (`hinweis_faellig`, by `tage[0]`), its day passed without
 * one so the leave does not expire (`hinweis_fehlt`), leave expires at the end of `tage[0]`
 * (`verfall_droht`), or it expired then (`verfallen`)
 */
export type VerfallBefund = Befund<
  "hinweis_faellig" | "hinweis_fehlt" | "verfall_droht" | "verfallen"
> & { jahr: number; halbtage: Halbtage };

export type Urlaubskonto = {
  toepfe: Urlaubstopf[];
  restHalbtage: Halbtage;
  befunde: VerfallBefund[];
};

export type UrlaubskontoErgebnis =
  | { ok: true; wert: Urlaubskonto }
  | { ok: false; grund: "ungueltig" };

const jahrText = (jahr: number): string => String(jahr).padStart(4, "0");

const uebertragenBisJahresende = (jahr: Urlaubsjahr): boolean =>
  jahr.teilurlaubA === true && jahr.uebertragungVerlangt === true;

/**
 * § 7 Abs. 3 Satz 3 BUrlG: carried over, leave must be taken by 31 March of the next year; Teilurlaub
 * carried over on request by its end (Satz 4). Soll always grants the carry-over (docs/regeln.md,
 * R-23) and asks for the notice three months before (docs/plan.md, "Verfall von Urlaub").
 */
const fristen = (jahr: Urlaubsjahr): { verfallstag: Tag; hinweisBis: Tag } =>
  uebertragenBisJahresende(jahr)
    ? {
        verfallstag: `${jahrText(jahr.jahr + 1)}-12-31`,
        hinweisBis: `${jahrText(jahr.jahr + 1)}-09-30`,
      }
    : {
        verfallstag: `${jahrText(jahr.jahr + 1)}-03-31`,
        hinweisBis: `${jahrText(jahr.jahr)}-12-31`,
      };

/**
 * When the leave of a year expires, given its first notice: in time, on its day; later, the leave
 * joins the leave of the year of the notice and expires with it (BAG, 19.02.2019, 9 AZR 423/16);
 * without a notice never (BAG, 20.12.2022, 9 AZR 266/20: nor does it become time-barred)
 */
const verfaelltAm = (
  fristenDesJahres: ReturnType<typeof fristen>,
  hinweis: Tag | null,
): Tag | null => {
  if (hinweis === null) return null;
  if (hinweis <= fristenDesJahres.hinweisBis) return fristenDesJahres.verfallstag;
  return `${jahrText(jahrVon(hinweis) + 1)}-03-31`;
};

const ganz = (zahl: number, ab: number): boolean => Number.isSafeInteger(zahl) && zahl >= ab;

const gueltig = (e: UrlaubskontoEingaben): boolean =>
  istTag(e.heute) &&
  new Set(e.jahre.map((j) => j.jahr)).size === e.jahre.length &&
  e.jahre.every((j) => ganz(j.jahr, 1) && j.jahr < 9999 && ganz(j.anspruchHalbtage, 0)) &&
  e.genommen.every((g) => istTag(g.tag) && ganz(g.halbtage, 1)) &&
  (e.anpassungen ?? []).every(
    (a) => ganz(a.jahr, 1) && a.jahr < 9999 && Number.isSafeInteger(a.halbtage),
  ) &&
  (e.hinweise ?? []).every(istTag);

/** One pot of leave per year, with the adjustments by hand and the notice that names it */
const toepfeAus = (e: UrlaubskontoEingaben): Urlaubstopf[] => {
  const hinweise = (e.hinweise ?? []).filter((tag) => tag <= e.heute).sort();
  const jahre = new Map(e.jahre.map((j) => [j.jahr, j] as const));
  for (const { jahr } of [
    ...(e.anpassungen ?? []),
    ...e.genommen.map((g) => ({ jahr: jahrVon(g.tag) })),
  ])
    if (!jahre.has(jahr)) jahre.set(jahr, { jahr, anspruchHalbtage: 0 });
  return [...jahre.values()]
    .sort((a, b) => a.jahr - b.jahr)
    .map((jahr) => {
      const frist = fristen(jahr);
      const hinweis = hinweise.find((tag) => jahrVon(tag) >= jahr.jahr) ?? null;
      const angepasst = (e.anpassungen ?? [])
        .filter((a) => a.jahr === jahr.jahr)
        .reduce((summe, a) => summe + a.halbtage, jahr.anspruchHalbtage);
      return {
        jahr: jahr.jahr,
        anspruchHalbtage: angepasst,
        genommenHalbtage: 0,
        verfallenHalbtage: 0,
        restHalbtage: angepasst,
        ...frist,
        hinweis,
        verfaelltAm: verfaelltAm(frist, hinweis),
      };
    });
};

const verfuegbarAm = (topf: Urlaubstopf, tag: Tag): boolean =>
  topf.jahr <= jahrVon(tag) && (topf.verfaelltAm === null || tag <= topf.verfaelltAm);

/**
 * Takes leave off the pots, the oldest first: it expires first, so the person keeps the most
 * (docs/plan.md, "Verfall von Urlaub"). More leave than open is charged to its own year.
 */
const abbuchen = (toepfe: Urlaubstopf[], genommen: readonly GenommenerUrlaub[]): void => {
  for (const eintrag of [...genommen].sort((a, b) => a.tag.localeCompare(b.tag))) {
    let offen = eintrag.halbtage;
    for (const topf of toepfe) {
      if (offen === 0 || !verfuegbarAm(topf, eintrag.tag) || topf.restHalbtage <= 0) continue;
      const teil = Math.min(offen, topf.restHalbtage);
      topf.restHalbtage -= teil;
      topf.genommenHalbtage += teil;
      offen -= teil;
    }
    const eigener = toepfe.find((topf) => topf.jahr === jahrVon(eintrag.tag));
    if (offen > 0 && eigener !== undefined) {
      eigener.restHalbtage -= offen;
      eigener.genommenHalbtage += offen;
    }
  }
};

const befund = (
  topf: Urlaubstopf,
  art: VerfallBefund["art"],
  tag: Tag,
  teilurlaub: boolean,
): VerfallBefund => ({
  regel: "R-23",
  norm: teilurlaub ? "§ 7 Abs. 3 Satz 4 BUrlG" : "§ 7 Abs. 3 BUrlG",
  schwere: "hinweis",
  art,
  tage: [tag],
  jahr: topf.jahr,
  halbtage: art === "verfallen" ? topf.verfallenHalbtage : topf.restHalbtage,
});

const befundeFuer = (topf: Urlaubstopf, heute: Tag, teilurlaub: boolean): VerfallBefund[] => {
  if (topf.verfallenHalbtage > 0)
    return [befund(topf, "verfallen", topf.verfaelltAm as Tag, teilurlaub)];
  if (topf.restHalbtage <= 0) return [];
  if (topf.verfaelltAm !== null)
    return [befund(topf, "verfall_droht", topf.verfaelltAm, teilurlaub)];
  return heute <= topf.hinweisBis
    ? [befund(topf, "hinweis_faellig", topf.hinweisBis, teilurlaub)]
    : [befund(topf, "hinweis_fehlt", topf.verfallstag, teilurlaub)];
};

/**
 * The leave account on a day (BAULISTE.md S-208, docs/regeln.md R-23): the leave of each year less
 * what was taken, carried over and expiring by § 7 Abs. 3 BUrlG only after the business told the
 * person in time (EuGH C-684/16 Max-Planck; BAG, 19.02.2019, 9 AZR 423/16). Computed, not stored
 * (docs/plan.md, "Konten").
 */
export const urlaubskonto = (e: UrlaubskontoEingaben): UrlaubskontoErgebnis => {
  if (!gueltig(e)) return { ok: false, grund: "ungueltig" };
  const toepfe = toepfeAus(e);
  abbuchen(
    toepfe,
    e.genommen.filter((g) => g.tag <= e.heute),
  );
  for (const topf of toepfe)
    if (topf.verfaelltAm !== null && e.heute > topf.verfaelltAm && topf.restHalbtage > 0) {
      topf.verfallenHalbtage = topf.restHalbtage;
      topf.restHalbtage = 0;
    }
  const teilurlaub = (jahr: number) =>
    e.jahre.some((j) => j.jahr === jahr && uebertragenBisJahresende(j));
  return {
    ok: true,
    wert: {
      toepfe,
      restHalbtage: toepfe.reduce((summe, topf) => summe + topf.restHalbtage, 0),
      befunde: toepfe.flatMap((topf) => befundeFuer(topf, e.heute, teilurlaub(topf.jahr))),
    },
  };
};

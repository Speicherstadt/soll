import type { Befund } from "../befund.ts";
import { istTag, jahrVon, type Tag } from "../kalender/tag.ts";
import { type Ablaufstand, ablaufen } from "./ablauf.ts";
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
  /**
   * What each notice named, per year (`verfallHinweis`, review S-708): where given, leave expires
   * only as far as a notice up to its day of expiry named it; leave no notice named stays. Without
   * it a notice names all leave open on its day.
   */
  benannt?: readonly BenannterHinweis[];
  heute: Tag;
};

/** A notice with the half days it named per year */
export type BenannterHinweis = {
  tag: Tag;
  posten: readonly { jahr: number; halbtage: Halbtage }[];
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
        // set with the notices by `ablaufen`
        hinweis: null,
        verfaelltAm: null,
      };
    });
};

const befund = (
  topf: Urlaubstopf,
  art: VerfallBefund["art"],
  tag: Tag,
  teilurlaub: boolean,
  halbtage: Halbtage,
): VerfallBefund => ({
  regel: "R-23",
  norm: teilurlaub ? "§ 7 Abs. 3 Satz 4 BUrlG" : "§ 7 Abs. 3 BUrlG",
  schwere: "hinweis",
  art,
  tage: [tag],
  jahr: topf.jahr,
  halbtage,
});

/**
 * The findings of a pot: what expired; of what is open, the part a notice lets expire next
 * (`verfall_droht`), and for the rest no notice names the notice still due or missing (review S-708)
 */
const befundeFuer = (
  topf: Urlaubstopf,
  stand: Ablaufstand | undefined,
  heute: Tag,
  teilurlaub: boolean,
): VerfallBefund[] => {
  const befunde: VerfallBefund[] = [];
  if (topf.verfallenHalbtage > 0 && stand?.verfallenAm)
    befunde.push(befund(topf, "verfallen", stand.verfallenAm, teilurlaub, topf.verfallenHalbtage));
  const droht = stand?.naechster ? Math.max(0, Math.min(stand.droht, topf.restHalbtage)) : 0;
  if (droht > 0 && stand?.naechster)
    befunde.push(befund(topf, "verfall_droht", stand.naechster, teilurlaub, droht));
  const ungenannt = topf.restHalbtage - droht;
  if (ungenannt > 0)
    befunde.push(
      heute <= topf.hinweisBis
        ? befund(topf, "hinweis_faellig", topf.hinweisBis, teilurlaub, ungenannt)
        : befund(topf, "hinweis_fehlt", topf.verfallstag, teilurlaub, ungenannt),
    );
  return befunde;
};

/**
 * The leave account on a day (BAULISTE.md S-208, docs/regeln.md R-23): the leave of each year less
 * what was taken, carried over and expiring by § 7 Abs. 3 BUrlG only after the business told the
 * person in time, and only as far as the notice named it (EuGH C-684/16 Max-Planck; BAG,
 * 19.02.2019, 9 AZR 423/16 and 9 AZR 541/15). Computed, not stored (docs/plan.md, "Konten").
 */
export const urlaubskonto = (e: UrlaubskontoEingaben): UrlaubskontoErgebnis => {
  if (!gueltig(e)) return { ok: false, grund: "ungueltig" };
  const toepfe = toepfeAus(e);
  const staende = ablaufen(e, toepfe);
  for (const topf of toepfe) {
    const stand = staende.get(topf.jahr);
    topf.verfaelltAm = stand?.naechster ?? stand?.zuletzt ?? null;
  }
  const teilurlaub = (jahr: number) =>
    e.jahre.some((j) => j.jahr === jahr && uebertragenBisJahresende(j));
  return {
    ok: true,
    wert: {
      toepfe,
      restHalbtage: toepfe.reduce((summe, topf) => summe + topf.restHalbtage, 0),
      befunde: toepfe.flatMap((topf) =>
        befundeFuer(topf, staende.get(topf.jahr), e.heute, teilurlaub(topf.jahr)),
      ),
    },
  };
};

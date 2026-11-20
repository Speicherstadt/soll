import type { Befund } from "../befund.ts";
import type { Standort } from "../feiertage/laender.ts";
import type { Tag } from "../kalender/tag.ts";
import { type NachtSonntagGrenzen, nachtSonntagGrenzenAm } from "./grenzen.ts";
import { arbeitAnRuhetagen, type RuhetagMitArbeit } from "./ruhetage.ts";
import { type Pruefergebnis, type PruefTag, sortiert } from "./typen.ts";

/**
 * What allows work on Sundays and holidays (docs/regeln.md, R-07), set by the business with its
 * source: an exception of § 10 Abs. 1 Nr. 1 to 16 ArbZG (e.g. Nr. 4 Gaststätten), the three hours of
 * § 10 Abs. 3 ArbZG for Bäckereien und Konditoreien, or a permit of the authority (§ 13 ArbZG), for
 * the days it names or, without days, for every day.
 */
export type Sonntagsausnahme =
  | { art: "abs1"; nummer: number }
  | { art: "baeckerei" }
  | { art: "bewilligung"; fundstelle: string; tage?: ReadonlySet<Tag> };

export type SonntagsruheOptionen = {
  /** the place of work: its Land and regions decide the holidays (S-105) */
  standort: Standort;
  /** default none: no work on Sundays and holidays */
  ausnahmen?: readonly Sonntagsausnahme[];
  /**
   * § 9 Abs. 2 ArbZG: minutes the rest is moved in a business with regular day and night shifts,
   * negative = earlier; default 0, and a value past six hours or not whole is 0, the rest of the law
   */
  verschiebung?: number;
};

/**
 * R-07: work in the rest of a Sunday (`sonntagsarbeit`) or holiday (`feiertagsarbeit`, also when it
 * falls on a Sunday) without an exception, or more than three hours in a bakery
 * (`ueber_3h_baeckerei`). `tage` is the Sunday or holiday, `minuten` the work in its rest, `ueber`
 * the minutes past what is allowed.
 */
export type SonntagsruheBefund = Befund<
  "sonntagsarbeit" | "feiertagsarbeit" | "ueber_3h_baeckerei"
> & {
  minuten: number;
  ueber: number;
  feiertag: string | null;
};

const NUMMERN_ABS1 = 16;

/** An exception of § 10 Abs. 1 ArbZG with a number the law has (Nr. 1 to 16); any other allows nothing */
export const gueltigNachAbs1 = (ausnahme: Sonntagsausnahme): boolean =>
  ausnahme.art === "abs1" &&
  Number.isInteger(ausnahme.nummer) &&
  ausnahme.nummer >= 1 &&
  ausnahme.nummer <= NUMMERN_ABS1;

/** Whether an exception allows any work on the day without a limit */
const frei = (ausnahmen: readonly Sonntagsausnahme[], tag: Tag): boolean =>
  ausnahmen.some(
    (ausnahme) =>
      gueltigNachAbs1(ausnahme) ||
      (ausnahme.art === "bewilligung" && (ausnahme.tage === undefined || ausnahme.tage.has(tag))),
  );

/** § 9 Abs. 2 ArbZG allows up to six hours; anything else is no move at all */
export const gueltigeVerschiebung = (verschiebung: number, grenzen: NachtSonntagGrenzen): number =>
  Number.isInteger(verschiebung) && Math.abs(verschiebung) <= grenzen.verschiebungHoechstens
    ? verschiebung
    : 0;

const amRuhetag = (
  ruhetag: RuhetagMitArbeit,
  ausnahmen: readonly Sonntagsausnahme[],
  grenzen: NachtSonntagGrenzen,
): SonntagsruheBefund[] => {
  if (frei(ausnahmen, ruhetag.tag)) return [];
  const baeckerei = ausnahmen.some((ausnahme) => ausnahme.art === "baeckerei");
  const erlaubt = baeckerei ? grenzen.baeckereiSonntag : 0;
  if (ruhetag.minuten <= erlaubt) return [];
  const feiertag = ruhetag.feiertag?.name ?? null;
  return [
    {
      regel: "R-07",
      norm: baeckerei ? "§ 10 Abs. 3 ArbZG" : "§ 9 Abs. 1 ArbZG",
      schwere: "verstoss",
      art: baeckerei
        ? "ueber_3h_baeckerei"
        : feiertag === null
          ? "sonntagsarbeit"
          : "feiertagsarbeit",
      tage: [ruhetag.tag],
      minuten: ruhetag.minuten,
      ueber: ruhetag.minuten - erlaubt,
      feiertag,
    },
  ];
};

/** The move of a day's rest, as its rule version allows it; none without a rule version */
export const verschiebungAus = (verschiebung: number | undefined, tag: Tag): number => {
  const grenzen = nachtSonntagGrenzenAm(tag);
  return grenzen === null ? 0 : gueltigeVerschiebung(verschiebung ?? 0, grenzen);
};

/**
 * § 9 ArbZG: no work on Sundays and legal holidays at the place of work from 0 to 24 Uhr, a shift
 * over midnight with the part that falls into the day (docs/regeln.md, R-07); the exceptions of
 * § 10 ArbZG and permits of § 13 ArbZG as settings.
 */
export const sonntagsruhe = (
  tage: readonly PruefTag[],
  { standort, ausnahmen = [], verschiebung }: SonntagsruheOptionen,
): Pruefergebnis<SonntagsruheBefund> => {
  const { ruhetage, nichtHinterlegt } = arbeitAnRuhetagen(tage, standort, (tag) =>
    verschiebungAus(verschiebung, tag),
  );
  const befunde: SonntagsruheBefund[] = [];
  const ohne = [...nichtHinterlegt];
  for (const ruhetag of ruhetage) {
    const grenzen = nachtSonntagGrenzenAm(ruhetag.tag);
    if (grenzen === null) ohne.push(ruhetag.tag);
    else befunde.push(...amRuhetag(ruhetag, ausnahmen, grenzen));
  }
  return { befunde, nichtHinterlegt: sortiert(ohne) };
};

import type { Befund } from "../befund.ts";
import { jahrVon, plusTage, type Tag, tagAus, wochentag } from "../kalender/tag.ts";
import { nachtSonntagGrenzenAm } from "./grenzen.ts";
import { arbeitAnRuhetagen } from "./ruhetage.ts";
import { type SonntagsruheOptionen, verschiebungAus } from "./sonntagsruhe.ts";
import { type Pruefergebnis, type PruefTag, sortiert } from "./typen.ts";

/**
 * R-08: with this Sunday as many Sundays of the year are worked as § 11 Abs. 1 ArbZG allows
 * (`kein_sonntag_mehr`, Hinweis), or more (`zu_wenig_freie_sonntage`, Verstoß, on every Sunday past
 * the limit). `gearbeitet` counts the worked Sundays of the year up to this one, `hoechstens` is the
 * Sundays of the year minus the 15 that stay free.
 */
export type FreieSonntageBefund = Befund<"kein_sonntag_mehr" | "zu_wenig_freie_sonntage"> & {
  jahr: number;
  sonntage: number;
  gearbeitet: number;
  hoechstens: number;
};

export type FreieSonntageOptionen = Pick<SonntagsruheOptionen, "standort" | "verschiebung">;

/** The Sundays of a calendar year: 52, or 53 when it begins on a Sunday or is a leap year beginning on a Saturday */
export const sonntageIm = (jahr: number): number => {
  const erster = tagAus(jahr, 1, 1);
  const ersterSonntag = plusTage(erster, (7 - wochentag(erster)) % 7);
  let anzahl = 0;
  for (let tag = ersterSonntag; jahrVon(tag) === jahr; tag = plusTage(tag, 7)) anzahl += 1;
  return anzahl;
};

/**
 * § 11 Abs. 1 ArbZG: at least 15 Sundays of each calendar year stay free of work (docs/regeln.md,
 * R-08). A Sunday is worked when any work falls into its rest (§ 9 ArbZG, as R-07 measures it).
 * Pass every working day of the year, from the Saturday before 1 January on.
 */
export const freieSonntage = (
  tage: readonly PruefTag[],
  { standort, verschiebung }: FreieSonntageOptionen,
): Pruefergebnis<FreieSonntageBefund> => {
  const { ruhetage, nichtHinterlegt } = arbeitAnRuhetagen(tage, standort, (tag) =>
    verschiebungAus(verschiebung, tag),
  );
  const befunde: FreieSonntageBefund[] = [];
  const ohne: Tag[] = [...nichtHinterlegt];
  const jeJahr = new Map<number, number>();
  for (const { tag } of ruhetage.filter((ruhetag) => ruhetag.sonntag)) {
    const grenzen = nachtSonntagGrenzenAm(tag);
    if (grenzen === null) {
      ohne.push(tag);
      continue;
    }
    const jahr = jahrVon(tag);
    const gearbeitet = (jeJahr.get(jahr) ?? 0) + 1;
    jeJahr.set(jahr, gearbeitet);
    const sonntage = sonntageIm(jahr);
    const hoechstens = sonntage - grenzen.freieSonntage;
    if (gearbeitet < hoechstens) continue;
    const verstoss = gearbeitet > hoechstens;
    befunde.push({
      regel: "R-08",
      norm: "§ 11 Abs. 1 ArbZG",
      schwere: verstoss ? "verstoss" : "hinweis",
      art: verstoss ? "zu_wenig_freie_sonntage" : "kein_sonntag_mehr",
      tage: [tag],
      jahr,
      sonntage,
      gearbeitet,
      hoechstens,
    });
  }
  return { befunde, nichtHinterlegt: sortiert(ohne) };
};

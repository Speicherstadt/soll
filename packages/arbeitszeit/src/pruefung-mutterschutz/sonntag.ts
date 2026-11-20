import type { Befund } from "../befund.ts";
import { plusTage, type Tag, wochenbeginn } from "../kalender/tag.ts";
import { beginnInBerlin } from "../kalender/zeit.ts";
import {
  arbeitAnRuhetagen,
  kalendertageMitArbeit,
  type RuhetagMitArbeit,
  ruhetagAm,
} from "../pruefung-nacht-sonntag/ruhetage.ts";
import { gueltigNachAbs1 } from "../pruefung-nacht-sonntag/sonntagsruhe.ts";
import { arbeitsbloecke } from "../pruefung-nacht-sonntag/typen.ts";
import type { MutterschutzGrenzen } from "./grenzen.ts";
import {
  fuerGeschuetzte,
  inSpanne,
  MINUTE,
  type MutterschutzOptionen,
  type Pruefergebnis,
  type PruefTag,
  sortiert,
} from "./typen.ts";

/** What § 6 Abs. 1 Satz 2 MuSchG asks for and was not given */
export type SonntagsBedingung = "erklaerung" | "ausnahme";

/**
 * R-21, § 6 Abs. 1 MuSchG: work on a Sunday (`sonntagsarbeit`) or holiday (`feiertagsarbeit`) without
 * her declaration or an exception under § 10 ArbZG (`fehlt`), or a week with such work without an
 * Ersatzruhetag (`ersatzruhetag_fehlt`, `woche` its Monday)
 */
export type MutterschutzSonntagBefund = Befund<
  "sonntagsarbeit" | "feiertagsarbeit" | "ersatzruhetag_fehlt"
> & {
  minuten?: number;
  fehlt?: SonntagsBedingung[];
  feiertag?: string | null;
  woche?: Tag;
};

type Ruhetag = RuhetagMitArbeit & { grenzen: MutterschutzGrenzen };

/**
 * § 6 Abs. 1 Satz 2 Nr. 2: an exception „nach § 10 des Arbeitszeitgesetzes“, Abs. 1 Nr. 1 to 16 or
 * Abs. 3; a permit under § 13 ArbZG is none
 */
const ausnahmeNach10 = (optionen: MutterschutzOptionen): boolean =>
  (optionen.ausnahmen ?? []).some(
    (ausnahme) => gueltigNachAbs1(ausnahme) || ausnahme.art === "baeckerei",
  );

const amRuhetag = (tag: Ruhetag, optionen: MutterschutzOptionen): MutterschutzSonntagBefund[] => {
  const fehlt: SonntagsBedingung[] = [
    ...(inSpanne(optionen.sonntagsbereitschaft ?? [], tag.tag) ? [] : ["erklaerung" as const]),
    ...(ausnahmeNach10(optionen) ? [] : ["ausnahme" as const]),
  ];
  if (fehlt.length === 0) return [];
  const feiertag = tag.feiertag?.name ?? null;
  return [
    {
      regel: "R-21",
      norm: "§ 6 Abs. 1 MuSchG",
      schwere: "verstoss",
      art: feiertag === null ? "sonntagsarbeit" : "feiertagsarbeit",
      tage: [tag.tag],
      minuten: tag.minuten,
      fehlt,
      feiertag,
    },
  ];
};

/**
 * § 6 Abs. 1 Satz 2 Nr. 3: a Werktag of the week without work from 0 to 24 Uhr, after a night's rest
 * of 11 hours without work
 */
const ersatzruhetagIn = (
  montag: Tag,
  tage: readonly PruefTag[],
  optionen: MutterschutzOptionen,
  grenzen: MutterschutzGrenzen,
): boolean => {
  const mitArbeit = kalendertageMitArbeit(tage);
  const bloecke = arbeitsbloecke(tage);
  return [0, 1, 2, 3, 4, 5, 6].some((versatz) => {
    const tag = plusTage(montag, versatz);
    const ruhetag = ruhetagAm(tag, optionen.standort);
    if (!ruhetag.ok || ruhetag.ruhetag !== null || mitArbeit.has(tag)) return false;
    const mitternacht = beginnInBerlin(tag);
    const nachtruhe = mitternacht - grenzen.ersatzruheNacht * MINUTE;
    return !bloecke.some((block) => block.ende > nachtruhe && block.beginn < mitternacht);
  });
};

/** Each week with Sunday or holiday work, judged once it is over */
const ersatzruhetage = (
  ruhetage: readonly Ruhetag[],
  tage: readonly PruefTag[],
  optionen: MutterschutzOptionen,
): MutterschutzSonntagBefund[] =>
  [...Map.groupBy(ruhetage, (tag) => wochenbeginn(tag.tag))].flatMap(
    ([montag, darin]): MutterschutzSonntagBefund[] => {
      const grenzen = darin[0]?.grenzen;
      if (grenzen === undefined || beginnInBerlin(plusTage(montag, 7)) > optionen.jetzt) return [];
      if (ersatzruhetagIn(montag, tage, optionen, grenzen)) return [];
      return [
        {
          regel: "R-21",
          norm: "§ 6 Abs. 1 Satz 2 Nr. 3 MuSchG",
          schwere: "verstoss",
          art: "ersatzruhetag_fehlt",
          tage: darin.map((tag) => tag.tag),
          woche: montag,
        },
      ];
    },
  );

/**
 * § 6 Abs. 1 MuSchG on the Sundays and holidays at the place of work in a span of the mark
 * (docs/regeln.md, R-21): work in their rest from 0 to 24 Uhr (as R-07, never moved) only with her
 * express declaration and an exception under § 10 ArbZG, and with an Ersatzruhetag in the same week
 * (Monday to Sunday) after a night's rest of 11 hours. That no danger arises from working alone
 * (Nr. 4) is the employer's to ensure; Soll cannot see it.
 */
export const mutterschutzSonntag = (
  tage: readonly PruefTag[],
  optionen: MutterschutzOptionen,
): Pruefergebnis<MutterschutzSonntagBefund> => {
  const gearbeitet = arbeitAnRuhetagen(tage, optionen.standort, () => 0);
  const geprueft = fuerGeschuetzte(
    gearbeitet.ruhetage,
    (tag) => tag.tag,
    optionen.zeitraeume,
    (tag, grenzen): Ruhetag[] => [{ ...tag, grenzen }],
  );
  return {
    befunde: [
      ...geprueft.befunde.flatMap((tag) => amRuhetag(tag, optionen)),
      ...ersatzruhetage(geprueft.befunde, tage, optionen),
    ],
    nichtHinterlegt: sortiert([...gearbeitet.nichtHinterlegt, ...geprueft.nichtHinterlegt]),
  };
};

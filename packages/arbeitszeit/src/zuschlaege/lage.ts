import type { Stueck } from "../arbeitstag/schichten.ts";
import { feiertagAm } from "../feiertage/feiertage.ts";
import type { Standort } from "../feiertage/laender.ts";
import { plusTage, type Tag, wochentag } from "../kalender/tag.ts";
import { minuteInBerlin } from "../kalender/wanduhr.ts";
import { beginnInBerlin, tagInBerlin, zeitpunktInBerlin } from "../kalender/zeit.ts";
import type { ZuschlagGrenzen } from "./grenzen.ts";

/**
 * The kinds of day of § 3b Abs. 1 Nr. 2 to 4 EStG: Sunday, a legal holiday at the place of work
 * (125 %), 25.12., 26.12. and 1.5. (150 %), 31.12. from 14 Uhr (125 %) and 24.12. from 14 Uhr (150 %)
 */
export type Tagesart = "sonntag" | "feiertag" | "feiertag_150" | "silvester" | "heiligabend";

/** Night work of § 3b Abs. 2 Satz 2 EStG, and 0 to 4 Uhr of a night begun before 0 Uhr (Abs. 3 Nr. 1) */
export type Nachtart = "nacht" | "nacht_0_4";

/**
 * A stretch of work in which every minute falls under the same rules: its Berlin calendar day, its
 * night work and the kinds of day it counts as. `folgetag` marks 0 to 4 Uhr after a Sunday or holiday
 * that counts as one (§ 3b Abs. 3 Nr. 2 EStG).
 */
export type Lage = Stueck & {
  tag: Tag;
  nacht: Nachtart | null;
  tagesarten: Tagesart[];
  folgetag: boolean;
  feiertag: string | null;
};

const MINUTE = 60_000;
const LETZTE_MINUTE = 24 * 60 - 1;

/** The kinds of day of a day at a wall-clock minute; null when its holidays are not known */
const tagesartenAm = (
  tag: Tag,
  minute: number,
  standort: Standort,
  grenzen: ZuschlagGrenzen,
): { arten: Tagesart[]; feiertag: string | null } | null => {
  const ergebnis = feiertagAm(tag, standort);
  if (!ergebnis.ok) return null;
  const datum = tag.slice(5);
  const nachmittag = minute >= grenzen.nachmittagAb;
  const arten: Tagesart[] = [];
  if (wochentag(tag) === 0) arten.push("sonntag");
  if (grenzen.feiertag150Tage.includes(datum)) arten.push("feiertag_150");
  else if (ergebnis.feiertag !== null) arten.push("feiertag");
  if (datum === grenzen.heiligabend && nachmittag) arten.push("heiligabend");
  if (datum === grenzen.silvester && nachmittag) arten.push("silvester");
  return { arten, feiertag: ergebnis.feiertag?.name ?? null };
};

/** § 3b Abs. 3 Nr. 2 EStG speaks of „dem Sonntag oder Feiertag“: 24.12. and 31.12. are neither */
const TRAGEN_IN_DEN_FOLGETAG: ReadonlySet<Tagesart> = new Set([
  "sonntag",
  "feiertag",
  "feiertag_150",
]);

/**
 * § 3b Abs. 3 EStG: „Wenn die Nachtarbeit vor 0 Uhr aufgenommen wird“ – the shift worked in the
 * night time of the evening before `tag`, from 20 Uhr to 0 Uhr
 */
export const nachtVorMitternacht = (
  bloecke: readonly Stueck[],
  tag: Tag,
  grenzen: ZuschlagGrenzen,
): boolean => {
  const von = zeitpunktInBerlin(plusTage(tag, -1), grenzen.nachtVon);
  const bis = beginnInBerlin(tag);
  return bloecke.some((block) => block.beginn < bis && block.ende > von);
};

/** The instants inside a block where a rule changes: 0, 4, 6, 14 and 20 Uhr on every day it touches */
const schnitte = (block: Stueck, grenzen: ZuschlagGrenzen): number[] => {
  const minuten = [
    0,
    grenzen.nachtKernBis,
    grenzen.nachtBis,
    grenzen.nachmittagAb,
    grenzen.nachtVon,
  ];
  const punkte = new Set<number>([block.beginn, block.ende]);
  const letzter = tagInBerlin(block.ende);
  for (let tag = tagInBerlin(block.beginn); tag <= letzter; tag = plusTage(tag, 1))
    for (const minute of minuten) {
      const punkt = zeitpunktInBerlin(tag, minute);
      if (punkt > block.beginn && punkt < block.ende) punkte.add(punkt);
    }
  return [...punkte].sort((a, b) => a - b);
};

/** The rules of one stretch, read at its first minute; null when a day's holidays are not known */
const lageVon = (
  beginn: number,
  ende: number,
  bloecke: readonly Stueck[],
  standort: Standort,
  grenzen: ZuschlagGrenzen,
): Lage | null => {
  const tag = tagInBerlin(beginn);
  const minute = minuteInBerlin(beginn);
  const eigen = tagesartenAm(tag, minute, standort, grenzen);
  if (eigen === null) return null;
  const kern = minute < grenzen.nachtKernBis && nachtVorMitternacht(bloecke, tag, grenzen);
  const istNacht = minute >= grenzen.nachtVon || minute < grenzen.nachtBis;
  const vortag = kern ? tagesartenAm(plusTage(tag, -1), LETZTE_MINUTE, standort, grenzen) : null;
  if (kern && vortag === null) return null;
  const geerbt = (vortag?.arten ?? []).filter((art) => TRAGEN_IN_DEN_FOLGETAG.has(art));
  return {
    beginn,
    ende,
    minuten: (ende - beginn) / MINUTE,
    tag,
    nacht: kern ? "nacht_0_4" : istNacht ? "nacht" : null,
    tagesarten: [...new Set([...eigen.arten, ...geerbt])],
    folgetag: geerbt.some((art) => !eigen.arten.includes(art)),
    feiertag: eigen.feiertag ?? (geerbt.length > 0 ? (vortag?.feiertag ?? null) : null),
  };
};

/**
 * The work of a shift cut at every change of the rules of § 3b EStG. Wall-clock times decide, so the
 * night of the October change has five hours from 0 to 4 Uhr and the March one three. Null when the
 * holidays of a day are "nicht hinterlegt".
 */
export const lagen = (
  bloecke: readonly Stueck[],
  standort: Standort,
  grenzen: ZuschlagGrenzen,
): Lage[] | null => {
  const ergebnis: Lage[] = [];
  for (const block of bloecke) {
    const punkte = schnitte(block, grenzen);
    for (let i = 0; i + 1 < punkte.length; i++) {
      const lage = lageVon(
        punkte[i] as number,
        punkte[i + 1] as number,
        bloecke,
        standort,
        grenzen,
      );
      if (lage === null) return null;
      ergebnis.push(lage);
    }
  }
  return ergebnis;
};

import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import type { Tag } from "../kalender/tag.ts";
import { ruhenAus } from "../pruefung/ruhezeit.ts";
import { mutterschutzGrenzenAm } from "./grenzen.ts";
import {
  inSpanne,
  type MutterschutzOptionen,
  type Pruefergebnis,
  type PruefTag,
  sortiert,
} from "./typen.ts";

/** R-21, § 4 Abs. 2 MuSchG: the rest between two working days falls `fehlt` minutes short of 11 hours */
export type MutterschutzRuhezeitBefund = Befund<"ruhezeit_zu_kurz"> & {
  ruhe: Stueck;
  mindestens: number;
  fehlt: number;
};

/**
 * § 4 Abs. 2 MuSchG (docs/regeln.md, R-21): at least 11 hours from the last Gehen of a working day to
 * the first Kommen of the next, measured like the rest of § 5 ArbZG (R-05) but never shortened, when
 * either day lies in a span of the mark; the limits are those of the day the rest ends on.
 */
export const mutterschutzRuhezeit = (
  tage: readonly PruefTag[],
  optionen: MutterschutzOptionen,
): Pruefergebnis<MutterschutzRuhezeitBefund> => {
  const befunde: MutterschutzRuhezeitBefund[] = [];
  const nichtHinterlegt: Tag[] = [];
  // only the rests between two working days: one still running owes nothing yet
  for (const ruhe of ruhenAus(tage, Number.NEGATIVE_INFINITY)) {
    if (ruhe.bis === null) continue;
    if (!inSpanne(optionen.zeitraeume, ruhe.von) && !inSpanne(optionen.zeitraeume, ruhe.bis))
      continue;
    const grenzen = mutterschutzGrenzenAm(ruhe.bis);
    if (grenzen === null) {
      nichtHinterlegt.push(ruhe.bis);
      continue;
    }
    if (ruhe.minuten >= grenzen.ruhezeit) continue;
    befunde.push({
      regel: "R-21",
      norm: "§ 4 Abs. 2 MuSchG",
      schwere: "verstoss",
      art: "ruhezeit_zu_kurz",
      tage: sortiert([ruhe.von, ruhe.bis]),
      ruhe: { beginn: ruhe.beginn, ende: ruhe.ende, minuten: ruhe.minuten },
      mindestens: grenzen.ruhezeit,
      fehlt: grenzen.ruhezeit - ruhe.minuten,
    });
  }
  return { befunde, nichtHinterlegt: [...new Set(nichtHinterlegt)].sort() };
};

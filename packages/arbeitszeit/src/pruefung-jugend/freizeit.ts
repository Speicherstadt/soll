import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import type { Tag } from "../kalender/tag.ts";
import { ruhenAus } from "../pruefung/ruhezeit.ts";
import { jugendGrenzenAm } from "./grenzen.ts";
import {
  type JugendOptionen,
  jugendlichAm,
  type Pruefergebnis,
  type PruefTag,
  sortiert,
} from "./typen.ts";

/** R-18, § 13 JArbSchG: the free time between two working days falls `fehlt` minutes short */
export type FreizeitBefund = Befund<"freizeit_zu_kurz"> & {
  ruhe: Stueck;
  mindestens: number;
  fehlt: number;
};

/**
 * § 13 JArbSchG (docs/regeln.md, R-18): at least 12 hours from the last Gehen of a working day to the
 * first Kommen of the next, measured like the rest of § 5 ArbZG (R-05), when the person is a
 * Jugendlicher on either day; the limits are those of the day the rest ends on.
 */
export const freizeit = (
  tage: readonly PruefTag[],
  optionen: JugendOptionen,
): Pruefergebnis<FreizeitBefund> => {
  const befunde: FreizeitBefund[] = [];
  const nichtHinterlegt: Tag[] = [];
  // only the rests between two working days: one still running owes nothing yet
  for (const ruhe of ruhenAus(tage, Number.NEGATIVE_INFINITY)) {
    if (ruhe.bis === null) continue;
    const grenzen = jugendGrenzenAm(ruhe.bis);
    if (grenzen === null) {
      nichtHinterlegt.push(ruhe.bis);
      continue;
    }
    const jugendlich = [ruhe.von, ruhe.bis].some((tag) =>
      jugendlichAm(optionen.geburtsdatum, tag, grenzen),
    );
    if (!jugendlich || ruhe.minuten >= grenzen.freizeit) continue;
    befunde.push({
      regel: "R-18",
      norm: "§ 13 JArbSchG",
      schwere: "verstoss",
      art: "freizeit_zu_kurz",
      tage: sortiert([ruhe.von, ruhe.bis]),
      ruhe: { beginn: ruhe.beginn, ende: ruhe.ende, minuten: ruhe.minuten },
      mindestens: grenzen.freizeit,
      fehlt: grenzen.freizeit - ruhe.minuten,
    });
  }
  return { befunde, nichtHinterlegt: [...new Set(nichtHinterlegt)].sort() };
};

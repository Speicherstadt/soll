import type { Befund } from "../befund.ts";
import type { ArbzgGrenzen } from "./grenzen.ts";
import { arbeitsMinutenAm, mitGrenzen, type Pruefergebnis, type PruefTag } from "./typen.ts";

/**
 * R-02: more than 8 hours on a working day is a Hinweis (to be balanced out, R-03), more than 10 a
 * Verstoß. `minuten` is the working time of the day, `ueber` the minutes past the limit crossed.
 */
export type HoechstarbeitszeitBefund = Befund<"ueber_8h" | "ueber_10h"> & {
  minuten: number;
  ueber: number;
};

const amTag = (tag: PruefTag, grenzen: ArbzgGrenzen): HoechstarbeitszeitBefund[] => {
  const minuten = arbeitsMinutenAm(tag);
  if (minuten <= grenzen.werktaeglich) return [];
  const verstoss = minuten > grenzen.verlaengert;
  return [
    {
      regel: "R-02",
      norm: "§ 3 Satz 2 ArbZG",
      schwere: verstoss ? "verstoss" : "hinweis",
      art: verstoss ? "ueber_10h" : "ueber_8h",
      tage: [tag.tag],
      minuten,
      ueber: minuten - (verstoss ? grenzen.verlaengert : grenzen.werktaeglich),
    },
  ];
};

/**
 * § 3 ArbZG per working day: every closed shift that begins on it counts, also on a Sunday or
 * holiday (§ 11 Abs. 2 ArbZG). docs/regeln.md, R-02.
 */
export const hoechstarbeitszeit = (
  tage: readonly PruefTag[],
): Pruefergebnis<HoechstarbeitszeitBefund> => mitGrenzen(tage, (tag) => tag.tag, amTag);

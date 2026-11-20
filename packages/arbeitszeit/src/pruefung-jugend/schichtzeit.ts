import type { Befund } from "../befund.ts";
import type { JugendGrenzen } from "./grenzen.ts";
import {
  fuerJugendliche,
  geschlossen,
  type JugendOptionen,
  MINUTE,
  type Pruefergebnis,
  type PruefTag,
} from "./typen.ts";

/** R-17, § 12 JArbSchG: the Schichtzeit of a day (`minuten`) runs `ueber` minutes past `grenze` */
export type SchichtzeitBefund = Befund<"schichtzeit"> & {
  minuten: number;
  grenze: number;
  ueber: number;
};

/** § 12: 8 hours under ground, 11 in the industries named and on Bau- und Montagestellen, else 10 */
const grenzeAm = (tag: PruefTag, optionen: JugendOptionen, grenzen: JugendGrenzen): number => {
  const branche = optionen.branche ?? "andere";
  if (branche === "bergbau_unter_tage") return grenzen.schichtzeitBergbau;
  if (grenzen.schichtzeitLangIn.includes(branche) || optionen.montagetage?.has(tag.tag))
    return grenzen.schichtzeitLang;
  return grenzen.schichtzeit;
};

/**
 * § 12 JArbSchG on the working days of a Jugendlicher (docs/regeln.md, R-17): the Schichtzeit is the
 * daily working time with all its breaks (§ 4 Abs. 2), from the first start to the last end of the
 * closed shifts of the day, in real minutes.
 */
export const schichtzeit = (
  tage: readonly PruefTag[],
  optionen: JugendOptionen,
): Pruefergebnis<SchichtzeitBefund> =>
  fuerJugendliche(
    tage,
    (tag) => tag.tag,
    optionen.geburtsdatum,
    (tag, grenzen): SchichtzeitBefund[] => {
      const schichten = geschlossen(tag);
      const erste = schichten[0];
      const letzte = schichten.at(-1);
      if (erste === undefined || letzte?.ende == null) return [];
      const minuten = (letzte.ende - erste.beginn) / MINUTE;
      const grenze = grenzeAm(tag, optionen, grenzen);
      if (minuten <= grenze) return [];
      return [
        {
          regel: "R-17",
          norm: "§ 12 JArbSchG",
          schwere: "verstoss",
          art: "schichtzeit",
          tage: [tag.tag],
          minuten,
          grenze,
          ueber: minuten - grenze,
        },
      ];
    },
  );

import { monatVon, type Tag, tageDesZeitraums } from "@soll/arbeitszeit";
import type { Db } from "../../../db/oeffnen.ts";
import { kanonisch } from "../../audit/hash.ts";
import { abgeschlosseneMonate } from "../abschluss.ts";
import { type AbwesenheitZeile, alsZeitraum, zaehlt } from "./lesen.ts";

type Fassung = Pick<
  AbwesenheitZeile,
  "art" | "von" | "bis" | "ersterHalb" | "letzterHalb" | "status" | "bescheinigung" | "kind"
>;

/** What a row records on each day it counts, as the month's content records it */
const beitrag = (zeile: Fassung | null, heute: Tag): Map<Tag, string> =>
  new Map(
    zeile === null || !zaehlt(zeile)
      ? []
      : tageDesZeitraums(alsZeitraum(zeile as AbwesenheitZeile), heute).map(
          ({ tag, ...rest }) => [tag, kanonisch(rest)] as const,
        ),
  );

/** The days on which a row records something else after a change (null: no row) */
export const geaenderteTage = (vorher: Fassung | null, nachher: Fassung | null, heute: Tag) => {
  const alt = beitrag(vorher, heute);
  const neu = beitrag(nachher, heute);
  return [...new Set([...alt.keys(), ...neu.keys()])]
    .filter((tag) => alt.get(tag) !== neu.get(tag))
    .sort();
};

/**
 * Whether a change of an absence would alter a day of a closed month of the person (docs/plan.md,
 * "Monat gesperrt"): such a change is refused, the correction is a counter-entry (S-306). A request
 * counts on no day, so it is refused for a closed month already when it is made (`auchAntrag`).
 */
export const abwesenheitGesperrt = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  aenderung: { vorher: Fassung | null; nachher: Fassung | null; heute: Tag; auchAntrag?: boolean },
): boolean => {
  const geschlossen = abgeschlosseneMonate(db, betriebId, nutzerId);
  if (geschlossen.size === 0) return false;
  const { vorher, nachher, heute } = aenderung;
  const alsGezaehlt = (zeile: Fassung | null) =>
    aenderung.auchAntrag && zeile ? { ...zeile, status: "genehmigt" as const } : zeile;
  return geaenderteTage(alsGezaehlt(vorher), alsGezaehlt(nachher), heute).some((tag) =>
    geschlossen.has(monatVon(tag)),
  );
};

import { monatVon, type Tag, tageDesZeitraums } from "@soll/arbeitszeit";
import type { Db } from "../../../db/oeffnen.ts";
import { kanonisch } from "../../audit/hash.ts";
import { abgeschlosseneMonate } from "../abschluss.ts";
import {
  type AbwesenheitZeile,
  abwesenheitenIn,
  alsZeitraum,
  tageDerAbwesenheiten,
  zaehlt,
} from "./lesen.ts";

type Fassung = Pick<
  AbwesenheitZeile,
  "art" | "von" | "bis" | "ersterHalb" | "letzterHalb" | "status" | "bescheinigung" | "kind"
>;

/**
 * What a row records on each day it counts, as the month's content records it (`amTag`): the
 * certificate only on a day with leave (`urlaubAm`)
 */
const beitrag = (zeile: Fassung | null, heute: Tag, urlaubAm: ReadonlySet<Tag>): Map<Tag, string> =>
  new Map(
    zeile === null || !zaehlt(zeile)
      ? []
      : tageDesZeitraums(alsZeitraum(zeile as AbwesenheitZeile), heute).map(
          ({ tag, bescheinigung, ...rest }) =>
            [
              tag,
              kanonisch(urlaubAm.has(tag) && bescheinigung ? { ...rest, bescheinigung } : rest),
            ] as const,
        ),
  );

/** The days on which a row records something else after a change (null: no row) */
export const geaenderteTage = (
  vorher: Fassung | null,
  nachher: Fassung | null,
  heute: Tag,
  urlaubAm: ReadonlySet<Tag> = new Set(),
) => {
  const alt = beitrag(vorher, heute, urlaubAm);
  const neu = beitrag(nachher, heute, urlaubAm);
  return [...new Set([...alt.keys(), ...neu.keys()])]
    .filter((tag) => alt.get(tag) !== neu.get(tag))
    .sort();
};

/** The days of approved leave of a person, where a certificate of sickness counts */
const urlaubstage = (db: Db, betriebId: string, nutzerId: string, heute: Tag): Set<Tag> =>
  new Set(
    tageDerAbwesenheiten(
      abwesenheitenIn(db, betriebId, {
        nutzerId,
        von: "0000-01-01",
        bis: "9999-12-31",
        status: ["genehmigt"],
      }).filter((zeile) => zeile.art === "urlaub"),
      heute,
    ).map((a) => a.tag),
  );

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
  const urlaubAm = urlaubstage(db, betriebId, nutzerId, heute);
  return geaenderteTage(alsGezaehlt(vorher), alsGezaehlt(nachher), heute, urlaubAm).some((tag) =>
    geschlossen.has(monatVon(tag)),
  );
};

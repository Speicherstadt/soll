import {
  type Monat,
  monatVon,
  plusTage,
  type Stempelung,
  type Tag,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { monatsabschluesse } from "../../db/schema.ts";
import { kanonisch } from "../audit/hash.ts";
import { aufzeichnungen } from "./monatsinhalt.ts";

/** The months the business closed for a person (S-306); a closed month locks its records */
export const abgeschlosseneMonate = (db: Db, betriebId: string, nutzerId: string): Set<Monat> =>
  new Set(
    db
      .select({ monat: monatsabschluesse.monat })
      .from(monatsabschluesse)
      .where(
        and(
          eq(monatsabschluesse.betriebId, betriebId),
          eq(monatsabschluesse.nutzerId, nutzerId),
          eq(monatsabschluesse.schritt, "abgeschlossen"),
        ),
      )
      .all()
      .map(({ monat }) => monat),
  );

/** Whether the month of `tag` is closed for a person (docs/plan.md, "Monat gesperrt") */
export const monatAbgeschlossen = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  tag: Tag,
): boolean => abgeschlosseneMonate(db, betriebId, nutzerId).has(monatVon(tag));

const stempelDesMonats = (monat: Monat, stempelungen: readonly Stempelung[]) =>
  kanonisch(aufzeichnungen(monat, stempelungen, () => null).map((tag) => tag.stempel));

/**
 * Whether a change of a person's stamps touches a closed month: an instant in a closed month, or a
 * change on a day next to a closed month that alters its stamps, as a night shift's Gehen after
 * midnight belongs to the day the shift began (CLAUDE.md, "Time"): on the first of a month for the
 * month before, on the last day of a month for the month after (a shift there that the first shift
 * of the closed month would join, or the Kommen of a night shift into it). `vorher` loads the
 * stamps in force around the instants (only when a month is closed), `nachher` gives them as the
 * change would leave them.
 */
export const aenderungGesperrt = <S extends Stempelung>(
  db: Db,
  betriebId: string,
  nutzerId: string,
  aenderung: {
    zeitpunkte: readonly number[];
    vorher: () => S[];
    nachher: (vorher: S[]) => Stempelung[];
  },
): boolean => {
  const geschlossen = abgeschlosseneMonate(db, betriebId, nutzerId);
  if (geschlossen.size === 0) return false;
  const tage = aenderung.zeitpunkte.map(tagInBerlin);
  if (tage.some((tag) => geschlossen.has(monatVon(tag)))) return true;
  const nachbarn = [
    ...new Set(tage.flatMap((tag) => [plusTage(tag, -1), plusTage(tag, 1)].map(monatVon))),
  ].filter((monat) => geschlossen.has(monat));
  if (nachbarn.length === 0) return false;
  const vorher = aenderung.vorher();
  const nachher = aenderung.nachher(vorher);
  return nachbarn.some(
    (monat) => stempelDesMonats(monat, vorher) !== stempelDesMonats(monat, nachher),
  );
};

/**
 * Whether a model assigned from `ab` until the next assignment (`bis`, exclusive; null: none) would
 * change the Soll of a closed month of the person
 */
export const zuordnungGesperrt = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  ab: Tag,
  bis: Tag | null,
): boolean => {
  const geschlossen = [...abgeschlosseneMonate(db, betriebId, nutzerId)];
  return geschlossen.some(
    (monat) => monat >= monatVon(ab) && (bis === null || `${monat}-01` < bis),
  );
};

import { type Monat, monatVon, type Stempelung, type Tag } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { aussonderungen, monatsabschluesse } from "../../db/schema.ts";
import { einsaetzeIn } from "./einsatzliste.ts";
import { aufzeichnungsKern, type Einsatzspanne, lesefenster } from "./monatsinhalt.ts";

/** The months of a person whose content was removed after the retention period (S-901) */
export const ausgesonderteMonate = (db: Db, betriebId: string, nutzerId: string): Set<Monat> =>
  new Set(
    db
      .select({ monat: aussonderungen.monat })
      .from(aussonderungen)
      .where(and(eq(aussonderungen.betriebId, betriebId), eq(aussonderungen.nutzerId, nutzerId)))
      .all()
      .map(({ monat }) => monat),
  );

/**
 * The months the business closed for a person (S-306); a closed month locks its records, also once
 * its content was removed after the retention period (S-901)
 */
export const abgeschlosseneMonate = (db: Db, betriebId: string, nutzerId: string): Set<Monat> =>
  new Set([
    ...db
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
    ...ausgesonderteMonate(db, betriebId, nutzerId),
  ]);

/** Whether the month of `tag` is closed for a person (docs/plan.md, "Monat gesperrt") */
export const monatAbgeschlossen = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  tag: Tag,
): boolean => abgeschlosseneMonate(db, betriebId, nutzerId).has(monatVon(tag));

/**
 * The records of a month's stamps in force and call-outs, read from the month's window
 * (`lesefenster`): a stamp can join a call-out's shift, and its day move with it (R-12, S-505)
 */
const stempelDesMonats = (
  monat: Monat,
  stempelungen: readonly Stempelung[],
  einsaetze: readonly Einsatzspanne[],
) => {
  const { von, bis } = lesefenster(monat);
  const imFenster = stempelungen.filter(({ zeitpunkt }) => zeitpunkt >= von && zeitpunkt < bis);
  return aufzeichnungsKern(monat, imFenster, einsaetze);
};

/**
 * Whether a change of a person's stamps alters the records of a closed month: every closed month
 * whose window (`lesefenster`) holds an instant of the change is read from that window before and
 * after, as closing and the check page read it, so a change let through leaves the records the
 * Prüfwert stands for, and only a change that would alter them is refused. So the Gehen on the first
 * of a closed month of a night shift of an open last day stays correctable (it is no record of the
 * closed month, and a counter-entry is only for closed days), while every stamp the closed month
 * records, and a shift its shifts would join or be cut by, is locked. `vorher` loads the stamps in
 * force from `von` to before `bis` (only when a month is closed), `nachher` gives them as the change
 * would leave them. Months in `ausser` are not compared: the removal after the retention period
 * (S-901) changes the records of the month it removes.
 */
export const aenderungGesperrt = <S extends Stempelung>(
  db: Db,
  betriebId: string,
  nutzerId: string,
  aenderung: {
    zeitpunkte: readonly number[];
    vorher: (von: number, bis: number) => S[];
    nachher: (vorher: S[]) => Stempelung[];
    ausser?: ReadonlySet<Monat>;
  },
): boolean => {
  const betroffen = [...abgeschlosseneMonate(db, betriebId, nutzerId)].filter((monat) => {
    if (aenderung.ausser?.has(monat)) return false;
    const { von, bis } = lesefenster(monat);
    return aenderung.zeitpunkte.some((zeitpunkt) => zeitpunkt >= von && zeitpunkt < bis);
  });
  if (betroffen.length === 0) return false;
  const fenster = betroffen.map(lesefenster);
  const vorher = aenderung.vorher(
    Math.min(...fenster.map(({ von }) => von)),
    Math.max(...fenster.map(({ bis }) => bis)),
  );
  const nachher = aenderung.nachher(vorher);
  const einsaetze = einsaetzeIn(
    db,
    betriebId,
    nutzerId,
    Math.min(...fenster.map(({ von }) => von)),
    Math.max(...fenster.map(({ bis }) => bis)),
  );
  return betroffen.some((monat) => {
    const { von, bis } = lesefenster(monat);
    const imFenster = einsaetze.filter(({ beginn }) => beginn >= von && beginn < bis);
    return (
      stempelDesMonats(monat, vorher, imFenster) !== stempelDesMonats(monat, nachher, imFenster)
    );
  });
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

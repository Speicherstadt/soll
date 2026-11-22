import {
  type AuslastungBuchung,
  anwesenheitImMonat,
  auslastungJePerson,
  beginnInBerlin,
  ersterTag,
  letzterTag,
  type Monat,
  type PersonAuslastung,
  plusTage,
} from "@soll/arbeitszeit";
import { and, eq, gte, lt, lte } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { projektzeiten, stempelungen } from "../../db/schema.ts";
import { stempelungenIn } from "../arbeitszeit/index.ts";
import { taetigkeitenLesen } from "./taetigkeiten.ts";

/** The stamps a month's working days are read from: two days before it to two days after it */
const fensterVon = (monat: Monat) => ({
  von: beginnInBerlin(plusTage(ersterTag(monat), -2)),
  bis: beginnInBerlin(plusTage(letzterTag(monat), 3)),
});

/**
 * The bookings of a month by their working day, each billable when it names an order and an
 * activity the business bills (docs/plan.md, "Abrechenbar und intern in der Auslastung")
 */
const buchungenIm = (db: Db, betriebId: string, monat: Monat): AuslastungBuchung[] => {
  const abrechenbar = new Set(
    taetigkeitenLesen(db, betriebId)
      .filter((taetigkeit) => taetigkeit.abrechenbar)
      .map((taetigkeit) => taetigkeit.taetigkeitId),
  );
  return db
    .select()
    .from(projektzeiten)
    .where(
      and(
        eq(projektzeiten.betriebId, betriebId),
        gte(projektzeiten.tag, ersterTag(monat)),
        lte(projektzeiten.tag, letzterTag(monat)),
      ),
    )
    .all()
    .map((zeile) => ({
      nutzerId: zeile.nutzerId,
      tag: zeile.tag,
      beginn: zeile.beginn,
      ende: zeile.ende,
      abrechenbar: zeile.projektId !== null && abrechenbar.has(zeile.taetigkeitId),
    }));
};

/** Everyone with a stamp around the month: also who left since, whose time stays in the month */
const stempelndeIm = (db: Db, betriebId: string, monat: Monat): string[] => {
  const { von, bis } = fensterVon(monat);
  return db
    .selectDistinct({ nutzerId: stempelungen.nutzerId })
    .from(stempelungen)
    .where(
      and(
        eq(stempelungen.betriebId, betriebId),
        gte(stempelungen.zeitpunkt, von),
        lt(stempelungen.zeitpunkt, bis),
      ),
    )
    .all()
    .map(({ nutzerId }) => nutzerId);
};

/**
 * The utilisation of a month per person of the business (S-604): stamped working time against
 * booked project time. Who may see which of it the routes decide: the team sum always, the people
 * only while the business has switched it on.
 */
export const auslastungImMonat = (
  db: Db,
  betriebId: string,
  monat: Monat,
  jetzt: number,
): PersonAuslastung[] => {
  const { von, bis } = fensterVon(monat);
  const anwesenheit = stempelndeIm(db, betriebId, monat).flatMap((nutzerId) =>
    anwesenheitImMonat(stempelungenIn(db, betriebId, nutzerId, von, bis), jetzt, monat).map(
      (tag) => ({ nutzerId, ...tag }),
    ),
  );
  return auslastungJePerson({
    monat,
    jetzt,
    anwesenheit,
    buchungen: buchungenIm(db, betriebId, monat),
  });
};

/** One person's month, zero when they have no time in it */
export const auslastungVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
  jetzt: number,
): PersonAuslastung =>
  auslastungImMonat(db, betriebId, monat, jetzt).find((p) => p.nutzerId === nutzerId) ?? {
    nutzerId,
    anwesendMinuten: 0,
    abrechenbarMinuten: 0,
    internMinuten: 0,
    ohneBuchungMinuten: 0,
    abrechenbarProzent: null,
  };

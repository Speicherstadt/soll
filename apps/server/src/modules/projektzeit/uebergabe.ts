import { buchungsMinuten } from "@soll/arbeitszeit";
import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { projektzeiten, stundennachweisBuchungen, stundennachweise } from "../../db/schema.ts";
import { namenVon } from "../mitglieder/index.ts";
import type { BuchungZeile } from "./buchungen-lesen.ts";
import { buchungLesen } from "./buchungen-lesen.ts";
import { type Ergebnis, nein, ok } from "./ergebnis.ts";
import { kundeLesen } from "./kunden.ts";
import { taetigkeitsNamen } from "./nachweis-auswahl.ts";
import { projektLesen } from "./projekte.ts";
import { taetigkeitenLesen } from "./taetigkeiten.ts";

/**
 * A finished booking on an order as a transfer to another program reads it (S-606): its row with
 * the rate it was billed with, the person's and the activity's name, whether the activity is billed,
 * the order with its customer (and the customer's reference in the other source) and the number of
 * the signed Stundennachweis that holds it
 */
export type BuchungMitBezug = {
  zeile: BuchungZeile;
  minuten: number;
  person: string;
  taetigkeit: string;
  abrechenbar: boolean;
  projekt: { projektId: string; name: string; nummer: string };
  kunde: { kundeId: string; name: string; externQuelle: string | null; externId: string | null };
  nachweisNummer: number | null;
};

const nachweisNummern = (db: Db, betriebId: string, ids: readonly string[]) =>
  new Map(
    db
      .select({ buchungId: stundennachweisBuchungen.buchungId, nummer: stundennachweise.nummer })
      .from(stundennachweisBuchungen)
      .innerJoin(
        stundennachweise,
        and(
          eq(stundennachweise.betriebId, stundennachweisBuchungen.betriebId),
          eq(stundennachweise.nachweisId, stundennachweisBuchungen.nachweisId),
        ),
      )
      .where(
        and(
          eq(stundennachweisBuchungen.betriebId, betriebId),
          inArray(stundennachweisBuchungen.buchungId, [...ids]),
        ),
      )
      .all()
      .map((zeile) => [zeile.buchungId, zeile.nummer]),
  );

/** The finished bookings on orders with what a transfer needs; a booking without an order is left out */
const mitBezug = (
  db: Db,
  betriebId: string,
  zeilen: readonly BuchungZeile[],
): BuchungMitBezug[] => {
  const personen = namenVon(
    db,
    zeilen.map((z) => z.nutzerId),
  );
  const namen = taetigkeitsNamen(db, betriebId);
  const abrechenbar = new Map(
    taetigkeitenLesen(db, betriebId).map((t) => [t.taetigkeitId, t.abrechenbar]),
  );
  const nummern = nachweisNummern(
    db,
    betriebId,
    zeilen.map((z) => z.buchungId),
  );
  return zeilen.flatMap((zeile) => {
    const projekt = zeile.projektId ? projektLesen(db, betriebId, zeile.projektId) : undefined;
    const kunde = projekt ? kundeLesen(db, betriebId, projekt.kundeId) : undefined;
    if (!projekt || !kunde || zeile.ende === null) return [];
    return [
      {
        zeile,
        minuten: buchungsMinuten(zeile.beginn, zeile.ende),
        person: personen.get(zeile.nutzerId) ?? "",
        taetigkeit: namen.get(zeile.taetigkeitId) ?? "",
        abrechenbar: abrechenbar.get(zeile.taetigkeitId) ?? false,
        projekt: { projektId: projekt.projektId, name: projekt.name, nummer: projekt.nummer },
        kunde: {
          kundeId: kunde.kundeId,
          name: kunde.name,
          externQuelle: kunde.externQuelle,
          externId: kunde.externId,
        },
        nachweisNummer: nummern.get(zeile.buchungId) ?? null,
      },
    ];
  });
};

/**
 * The named bookings with what a transfer needs, all or none: each known (`unbekannt`), finished
 * (`laeuft`) and on an order (`ohne_auftrag`: internal time has no customer to bill)
 */
export const buchungenMitBezug = (
  db: Db,
  betriebId: string,
  ids: readonly string[],
): Ergebnis<BuchungMitBezug[]> => {
  const zeilen: BuchungZeile[] = [];
  for (const id of new Set(ids)) {
    const zeile = buchungLesen(db, betriebId, id);
    if (!zeile) return nein("unbekannt");
    if (zeile.ende === null) return nein("laeuft");
    if (zeile.projektId === null) return nein("ohne_auftrag");
    zeilen.push(zeile);
  }
  return ok(mitBezug(db, betriebId, zeilen));
};

/** The finished bookings on an order whose working day lies in the span, in time order */
export const buchungenImAuftrag = (
  db: Db,
  betriebId: string,
  auswahl: { projektId: string; von: string; bis: string },
): Ergebnis<BuchungMitBezug[]> => {
  if (!projektLesen(db, betriebId, auswahl.projektId)) return nein("projekt_unbekannt");
  const zeilen = db
    .select()
    .from(projektzeiten)
    .where(
      and(
        eq(projektzeiten.betriebId, betriebId),
        eq(projektzeiten.projektId, auswahl.projektId),
        gte(projektzeiten.tag, auswahl.von),
        lte(projektzeiten.tag, auswahl.bis),
        isNotNull(projektzeiten.ende),
      ),
    )
    .orderBy(projektzeiten.tag, projektzeiten.beginn, projektzeiten.nutzerId)
    .all();
  return ok(mitBezug(db, betriebId, zeilen));
};

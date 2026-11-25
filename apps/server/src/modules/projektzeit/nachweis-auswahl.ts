import { buchungsMinuten, type FesteTaetigkeit, istFesteTaetigkeit } from "@soll/arbeitszeit";
import type { NachweisZeile } from "@soll/export";
import { and, eq, gte, isNotNull, lte, notExists } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { projektzeiten, stundennachweisBuchungen } from "../../db/schema.ts";
import { kanonisch, sha256 } from "../audit/index.ts";
import { namenVon } from "../mitglieder/index.ts";
import { type Ergebnis, nein, ok } from "./ergebnis.ts";
import { kundeLesen } from "./kunden.ts";
import { projektLesen } from "./projekte.ts";
import { taetigkeitenLesen } from "./taetigkeiten.ts";

/** Which bookings a Stundennachweis holds: one order, a span of working days, one person or all */
export type Auswahl = { projektId: string; von: string; bis: string; nutzerId: string | null };

/** A row of the preview: the booking it shows and what the report will freeze of it */
export type VorschauZeile = NachweisZeile & { buchungId: string };

/**
 * What the customer sees before signing (S-605). `stand` is the SHA-256 of the rows: signing names
 * it, so a booking that changed, came or went since the preview refuses the signature
 */
export type Vorschau = {
  kunde: { name: string; nummer: string };
  auftrag: { name: string; nummer: string };
  von: string;
  bis: string;
  zeilen: VorschauZeile[];
  summeMinuten: number;
  stand: string;
};

/** The fixed activities in German, as the PDF and the text for Haben write them (docs/plan.md, "Sprache des Stundenzettels") */
const FESTE_NAMEN: Record<FesteTaetigkeit, string> = {
  fahrt: "Fahrt",
  werkstatt: "Werkstatt",
  lager: "Lager",
  schulung: "Schulung",
};

export const taetigkeitsNamen = (db: Db, betriebId: string): Map<string, string> =>
  new Map(
    taetigkeitenLesen(db, betriebId).map((t) => [
      t.taetigkeitId,
      istFesteTaetigkeit(t.taetigkeitId) ? FESTE_NAMEN[t.taetigkeitId] : t.name,
    ]),
  );

/** The finished bookings of the selection that are in no signed report yet, in time order */
const offeneBuchungen = (db: Db, betriebId: string, auswahl: Auswahl) =>
  db
    .select()
    .from(projektzeiten)
    .where(
      and(
        eq(projektzeiten.betriebId, betriebId),
        eq(projektzeiten.projektId, auswahl.projektId),
        gte(projektzeiten.tag, auswahl.von),
        lte(projektzeiten.tag, auswahl.bis),
        isNotNull(projektzeiten.ende),
        auswahl.nutzerId === null ? undefined : eq(projektzeiten.nutzerId, auswahl.nutzerId),
        notExists(
          db
            .select()
            .from(stundennachweisBuchungen)
            .where(
              and(
                eq(stundennachweisBuchungen.betriebId, betriebId),
                eq(stundennachweisBuchungen.buchungId, projektzeiten.buchungId),
              ),
            ),
        ),
      ),
    )
    .orderBy(projektzeiten.tag, projektzeiten.beginn, projektzeiten.nutzerId)
    .all();

/** The preview of a report: the order's customer, the open bookings with names, sum and `stand` */
export const nachweisVorschau = (
  db: Db,
  betriebId: string,
  auswahl: Auswahl,
): Ergebnis<Vorschau> => {
  const projekt = projektLesen(db, betriebId, auswahl.projektId);
  if (!projekt) return nein("projekt_unbekannt");
  const kunde = kundeLesen(db, betriebId, projekt.kundeId);
  const buchungen = offeneBuchungen(db, betriebId, auswahl);
  const personen = namenVon(
    db,
    buchungen.map((b) => b.nutzerId),
  );
  const taetigkeiten = taetigkeitsNamen(db, betriebId);
  const zeilen = buchungen.map((b) => {
    const ende = b.ende ?? b.beginn;
    return {
      buchungId: b.buchungId,
      tag: b.tag,
      person: personen.get(b.nutzerId) ?? "",
      beginn: b.beginn,
      ende,
      minuten: buchungsMinuten(b.beginn, ende),
      taetigkeit: taetigkeiten.get(b.taetigkeitId) ?? "",
      notiz: b.notiz,
    };
  });
  return ok({
    kunde: { name: kunde?.name ?? "", nummer: kunde?.nummer ?? "" },
    auftrag: { name: projekt.name, nummer: projekt.nummer },
    von: auswahl.von,
    bis: auswahl.bis,
    zeilen,
    summeMinuten: zeilen.reduce((summe, zeile) => summe + zeile.minuten, 0),
    stand: sha256(kanonisch(zeilen)),
  });
};

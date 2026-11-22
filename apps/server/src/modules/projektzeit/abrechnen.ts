import { betragCent, buchungsMinuten } from "@soll/arbeitszeit";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { type Kontext, type Schreiber, schreiben } from "../audit/index.ts";
import { type BuchungZeile, buchungLesen } from "./buchungen-lesen.ts";
import { type Ergebnis, nein, ok } from "./ergebnis.ts";
import { satzFuer } from "./saetze.ts";
import { taetigkeitLesen } from "./taetigkeiten.ts";

export type Abgerechnet = { buchungId: string; centProStunde: number | null; betragCent: number };

/**
 * The rate a booking is billed with: the rate in force on its working day for a billable activity,
 * none (null) for an activity the business does not bill or without a fitting rate (nicht
 * hinterlegt: Soll guesses no amount)
 */
const satzBeimAbrechnen = (db: Db, zeile: BuchungZeile): number | null => {
  if (!taetigkeitLesen(db, zeile.betriebId, zeile.taetigkeitId)?.abrechenbar) return null;
  const satz = satzFuer(db, zeile.betriebId, zeile);
  return satz.ok && satz.wert.art === "satz" ? satz.wert.centProStunde : null;
};

/** The bookings to bill, all or none: each known, finished and not billed yet */
const abrechenbare = (db: Db, betriebId: string, ids: readonly string[]) => {
  const zeilen: BuchungZeile[] = [];
  for (const id of new Set(ids)) {
    const zeile = buchungLesen(db, betriebId, id);
    if (!zeile) return nein<BuchungZeile[]>("unbekannt");
    if (zeile.ende === null) return nein<BuchungZeile[]>("laeuft");
    if (zeile.abgerechnetAm !== null) return nein<BuchungZeile[]>("abgerechnet");
    zeilen.push(zeile);
  }
  return ok(zeilen);
};

/**
 * Marks bookings as billed (owner and planner by hand, or the transfer to Haben, S-606): from then on
 * they are locked, and each keeps the rate it was billed with, so a later change of the rates
 * changes no bill. One transaction: all named bookings or none, together with what `dazu` writes
 * (the transfer's own rows).
 */
export const buchungenAbrechnen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  ids: readonly string[],
  dazu: (s: Schreiber, buchungIds: readonly string[]) => void = () => undefined,
): Ergebnis<Abgerechnet[]> => {
  const geprueft = abrechenbare(db, kontext.betriebId, ids);
  if (!geprueft.ok) return nein(geprueft.grund);
  const zeilen = geprueft.wert.map((zeile) => ({ zeile, satz: satzBeimAbrechnen(db, zeile) }));
  schreiben(schreibDb, kontext, (s) => {
    for (const { zeile, satz } of zeilen)
      s.aendern(
        "projektzeiten",
        { buchungId: zeile.buchungId },
        { abgerechnetAm: kontext.jetzt, centProStunde: satz },
      );
    dazu(
      s,
      zeilen.map(({ zeile }) => zeile.buchungId),
    );
  });
  return ok(
    zeilen.map(({ zeile, satz }) => ({
      buchungId: zeile.buchungId,
      centProStunde: satz,
      betragCent: satz === null ? 0 : betragCent(buchungsMinuten(zeile.beginn, zeile.ende), satz),
    })),
  );
};

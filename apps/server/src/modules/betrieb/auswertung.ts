import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { type Betrieb, betriebLesen, modulAktiv } from "./index.ts";

/**
 * Since when the business shows the utilisation per person (S-604), as every member reads it: only
 * while the module Projektzeit is on, where the utilisation lives
 */
export const auswertungJePersonSeit = (db: Db, betrieb: Betrieb): number | null =>
  modulAktiv(db, betrieb.betriebId, "projektzeit") ? betrieb.auswertungJePersonSeit : null;

export type AuswertungErgebnis =
  | { ok: true; jePersonSeit: number | null }
  | { ok: false; grund: "kein_betrieb" };

/**
 * Switches the utilisation per person on or off (§ 87 Abs. 1 Nr. 6 BetrVG): through the audit
 * chain, so who switched it when stays on record. Switching it on again keeps the first instant;
 * switching it off clears it.
 */
export const auswertungJePersonSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  an: boolean,
): AuswertungErgebnis => {
  const betrieb = betriebLesen(db, kontext.betriebId);
  if (!betrieb) return { ok: false, grund: "kein_betrieb" };
  const bisher = betrieb.auswertungJePersonSeit;
  if (an === (bisher !== null)) return { ok: true, jePersonSeit: bisher };
  const neu = schreiben(schreibDb, kontext, (s) =>
    s.aendern(
      "betriebe",
      { betriebId: kontext.betriebId },
      { auswertungJePersonSeit: an ? kontext.jetzt : null },
    ),
  );
  return { ok: true, jePersonSeit: neu.auswertungJePersonSeit };
};

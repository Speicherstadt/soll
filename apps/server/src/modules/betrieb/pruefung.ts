import type { Ausgleichszeitraum, Branche, PlanBetrieb, Tag } from "@soll/arbeitszeit";
import type { SchreibDb } from "../../db/oeffnen.ts";
import type { betriebe } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

/**
 * The settings of a business the rules read (S-502, docs/plan.md "Einstellungen zur Prüfung"). Null
 * keeps the default, which is never less strict than the law: no shortened rest (§ 5 Abs. 2 ArbZG),
 * no work on Sundays and holidays (§ 9 ArbZG), both Ausgleichszeiträume from 1 January 2026.
 */
export type Pruefeinstellungen = {
  branche: Branche | null;
  /** the number of § 10 Abs. 1 ArbZG, 1 to 16 */
  sonntagsausnahme: number | null;
  ausgleichszeitraum: "sechs_monate" | "24_wochen" | null;
  ausgleichBeginn: Tag | null;
};

export const pruefeinstellungenVon = (
  betrieb: typeof betriebe.$inferSelect,
): Pruefeinstellungen => ({
  branche: betrieb.branche as Branche | null,
  sonntagsausnahme: betrieb.sonntagsausnahme,
  ausgleichszeitraum: betrieb.ausgleichszeitraum,
  ausgleichBeginn: betrieb.ausgleichBeginn,
});

export const pruefeinstellungenSetzen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  werte: Pruefeinstellungen,
): Pruefeinstellungen =>
  pruefeinstellungenVon(
    schreiben(schreibDb, kontext, (s) =>
      s.aendern("betriebe", { betriebId: kontext.betriebId }, werte),
    ),
  );

/** The settings in the form of the check of the plan (packages/arbeitszeit, `planBefunde`) */
export const planBetriebAus = (einstellungen: Pruefeinstellungen): PlanBetrieb => ({
  ...(einstellungen.branche ? { branche: einstellungen.branche } : {}),
  ...(einstellungen.sonntagsausnahme
    ? { ausnahmen: [{ art: "abs1" as const, nummer: einstellungen.sonntagsausnahme }] }
    : {}),
  ...(einstellungen.ausgleichszeitraum
    ? { zeitraum: einstellungen.ausgleichszeitraum satisfies Ausgleichszeitraum }
    : {}),
  ...(einstellungen.ausgleichBeginn ? { beginn: einstellungen.ausgleichBeginn } : {}),
});

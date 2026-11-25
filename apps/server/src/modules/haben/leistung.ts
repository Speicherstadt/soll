import type { Leistung } from "./haben-api.ts";

/** The name Soll gives itself as `source` at Haben; `externalId` is the booking's id */
export const QUELLE = "soll";

/** What Soll knows of a billed booking when it hands it over */
export type Abgerechnet = {
  buchungId: string;
  tag: string;
  minuten: number;
  taetigkeit: string;
  notiz: string;
  abrechenbar: boolean;
  /** the rate the booking was billed with; null: none (nicht hinterlegt or not billable) */
  centProStunde: number | null;
  projekt: { name: string; nummer: string };
  /** the customer's contact in Haben */
  kontaktId: string;
  /** the number of the signed Stundennachweis that holds the booking, if one does */
  nachweisNummer: number | null;
};

/** Haben's limits (serviceEntryCreateSchema): description 2,000 characters, project 200 */
const BESCHREIBUNG = 2_000;
const PROJEKT = 200;

/**
 * The text on the invoice: the activity, the note and the Stundennachweis it was signed in; no name
 * of the person (Art. 5 Abs. 1 lit. c DSGVO: the invoice needs the work, not who did it)
 */
const beschreibung = (b: Abgerechnet): string => {
  const text = [b.taetigkeit, b.notiz.trim()].filter(Boolean).join(": ");
  const nachweis = b.nachweisNummer === null ? "" : `Stundennachweis Nr. ${b.nachweisNummer}`;
  const ganz = text && nachweis ? `${text} (${nachweis})` : text || nachweis;
  return ganz.slice(0, BESCHREIBUNG);
};

/**
 * A billed booking as a Leistung for Haben (docs/api.md, "Leistungen und Zeiterfassung"): the working
 * day as `workedOn`, the whole minutes, the order as `project`. A billable booking brings the rate
 * it was billed with; without one Haben takes the customer's rate (Soll guesses none). A booking of
 * an activity the business does not bill goes as `nonBillable`, so it never reaches an invoice.
 */
export const leistungAus = (b: Abgerechnet): Leistung => ({
  contactId: b.kontaktId,
  workedOn: b.tag,
  minutes: b.minuten,
  description: beschreibung(b),
  ...(b.abrechenbar && b.centProStunde !== null ? { hourlyRateCents: b.centProStunde } : {}),
  nonBillable: !b.abrechenbar,
  project: (b.projekt.nummer ? `${b.projekt.nummer} ${b.projekt.name}` : b.projekt.name).slice(
    0,
    PROJEKT,
  ),
  source: QUELLE,
  externalId: b.buchungId,
});

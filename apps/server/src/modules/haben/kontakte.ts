import type { Kontext } from "../audit/index.ts";
import { kundeAnlegen, kundenLesen, kundeVerbinden } from "../projektzeit/index.ts";
import { type HabenFehler, kontakteLesen, kontaktLesen } from "./haben-api.ts";
import { HABEN, type HabenDeps } from "./uebergabe.ts";
import { anschlussVon } from "./zugang.ts";

/** Why reading or linking a contact failed: no access, the key, Haben's failure, or Soll's refusal */
export type KontaktFehler =
  | {
      ok: false;
      grund: "haben_fehlt" | "schluessel_falsch" | "kontakt_unbekannt" | "unbekannt" | "doppelt";
    }
  | { ok: false; grund: "haben"; fehler: HabenFehler; meldung: string };

/** A contact of Haben as Soll lists it, with the customer of the business it is linked to */
export type Kontakt = {
  id: string;
  name: string;
  kundennummer: string | null;
  kundeId: string | null;
};

/** Soll's limits for a customer's name and number (routes/projektzeit-gemeinsam.ts) */
const NAME = 100;
const NUMMER = 40;

/** The contacts in the business's Haben that are not archived, each with its linked customer */
export const habenKontakte = async (
  deps: HabenDeps,
  betriebId: string,
): Promise<{ ok: true; wert: Kontakt[] } | KontaktFehler> => {
  const anschluss = anschlussVon(deps.db, deps.schluessel, betriebId, deps.holen);
  if (!anschluss.ok) return anschluss;
  const antwort = await kontakteLesen(anschluss.wert);
  if (!antwort.ok)
    return { ok: false, grund: "haben", fehler: antwort.fehler, meldung: antwort.meldung };
  const verbunden = new Map(
    kundenLesen(deps.db, betriebId)
      .filter((k) => k.externQuelle === HABEN && k.externId !== null)
      .map((k) => [k.externId, k.kundeId]),
  );
  return {
    ok: true,
    wert: antwort.wert.map((k) => ({
      id: k.id,
      name: k.name,
      kundennummer: k.kundennummer,
      kundeId: verbunden.get(k.id) ?? null,
    })),
  };
};

/**
 * Links a contact of Haben with a customer of the business ("Kunden lesen", S-606): with `kundeId`
 * the existing customer, without one a new customer with the contact's name and customer number.
 * The contact is read first, so only one Haben knows is linked (`kontakt_unbekannt`).
 */
export const kontaktVerbinden = async (
  deps: HabenDeps,
  kontext: Kontext,
  kontaktId: string,
  kundeId: string | undefined,
) => {
  const anschluss = anschlussVon(deps.db, deps.schluessel, kontext.betriebId, deps.holen);
  if (!anschluss.ok) return anschluss;
  const kontakt = await kontaktLesen(anschluss.wert, kontaktId);
  if (!kontakt.ok)
    return kontakt.fehler === "abgelehnt"
      ? ({ ok: false, grund: "kontakt_unbekannt" } as const)
      : ({ ok: false, grund: "haben", fehler: kontakt.fehler, meldung: kontakt.meldung } as const);
  const extern = { externQuelle: HABEN, externId: kontakt.wert.id };
  return kundeId === undefined
    ? kundeAnlegen(deps.schreibDb, kontext, {
        name: kontakt.wert.name.trim().slice(0, NAME) || kontakt.wert.id,
        nummer: (kontakt.wert.kundennummer ?? "").trim().slice(0, NUMMER),
        ...extern,
      })
    : kundeVerbinden(deps.db, deps.schreibDb, kontext, kundeId, extern);
};

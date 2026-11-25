import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { type Kontext, kanonisch, schreiben } from "../audit/index.ts";
import {
  type BuchungMitBezug,
  buchungenAbrechnen,
  buchungenImAuftrag,
  buchungenMitBezug,
  type Grund,
  kundenLesen,
  projekteLesen,
} from "../projektzeit/index.ts";
import { type HabenAnschluss, type Leistung, leistungSenden } from "./haben-api.ts";
import { leistungAus } from "./leistung.ts";
import { staendeVon, type UebergabeStand, uebergabenVon } from "./stand.ts";
import { anschlussVon } from "./zugang.ts";

/** What the link to Haben works with: the database, SOLL_SECRET_KEY and how to call Haben */
export type HabenDeps = {
  db: Db;
  schreibDb: SchreibDb;
  schluessel: Uint8Array;
  holen: typeof fetch;
};

/** The source a linked customer names at its contact in Haben (`kunden.extern_quelle`) */
export const HABEN = "haben";

export type UebergabeGrund = Grund | "haben_fehlt" | "schluessel_falsch" | "kunde_ohne_haben";

type Antwort<T> = { ok: true; wert: T } | { ok: false; grund: UebergabeGrund };

/** At most this many bookings per transfer: Haben takes 120 calls a minute per token */
export const HOECHSTENS = 100;

/**
 * Which of the named bookings can go to Haben: each on an order of a customer linked to a contact in
 * Haben (`kunde_ohne_haben`), and none billed by hand before (`abgerechnet`): that one was billed
 * outside Haben, sending it would bill it twice
 */
const pruefen = (
  db: Db,
  betriebId: string,
  buchungen: readonly BuchungMitBezug[],
): UebergabeGrund | null => {
  const uebergaben = uebergabenVon(
    db,
    betriebId,
    buchungen.map((b) => b.zeile.buchungId),
  );
  for (const b of buchungen) {
    if (b.zeile.abgerechnetAm !== null && !uebergaben.has(b.zeile.buchungId)) return "abgerechnet";
    if (b.kunde.externQuelle !== HABEN || !b.kunde.externId) return "kunde_ohne_haben";
  }
  return null;
};

/** The Leistung of a booking as it is billed, with the rate it was billed with */
const leistungVon = (b: BuchungMitBezug, centProStunde: number | null): Leistung =>
  leistungAus({
    buchungId: b.zeile.buchungId,
    tag: b.zeile.tag,
    minuten: b.minuten,
    taetigkeit: b.taetigkeit,
    notiz: b.zeile.notiz,
    abrechenbar: b.abrechenbar,
    centProStunde,
    projekt: { name: b.projekt.name, nummer: b.projekt.nummer },
    kontaktId: b.kunde.externId ?? "",
    nachweisNummer: b.nachweisNummer,
  });

/**
 * Bills the bookings not billed yet and notes each for Haben with its Leistung as billed, in one
 * transaction: every try sends that content, so a later change of an activity, an order or a rate
 * changes nothing already billed (docs/plan.md, "Keine Leistung doppelt")
 */
const abrechnenFuerHaben = (
  deps: HabenDeps,
  kontext: Kontext,
  buchungen: readonly BuchungMitBezug[],
) => {
  const neue = new Map(
    buchungen.filter((b) => b.zeile.abgerechnetAm === null).map((b) => [b.zeile.buchungId, b]),
  );
  if (neue.size === 0) return null;
  const ergebnis = buchungenAbrechnen(
    deps.db,
    deps.schreibDb,
    kontext,
    [...neue.keys()],
    (s, abgerechnet) => {
      for (const { buchungId, centProStunde } of abgerechnet)
        s.einfuegen("habenUebergaben", {
          betriebId: kontext.betriebId,
          buchungId,
          inhalt: kanonisch(leistungVon(neue.get(buchungId) as BuchungMitBezug, centProStunde)),
          angelegtAm: kontext.jetzt,
        });
    },
  );
  return ergebnis.ok ? null : ergebnis.grund;
};

/** A failure that concerns every call, not this entry: the rest waits for the next try */
const anHabenGescheitert = (fehler: string) => fehler !== "abgelehnt";

/**
 * Sends one billed booking and keeps Haben's answer; false when Haben cannot take any now. It sends
 * the Leistung as billed; only the contact is the one the customer is linked to now, so a booking
 * Haben refused for a wrong contact goes once the customer is linked right.
 */
const senden = async (
  deps: HabenDeps,
  kontext: Kontext,
  anschluss: HabenAnschluss,
  b: BuchungMitBezug,
  inhalt: string | null,
): Promise<boolean> => {
  const leistung: Leistung = {
    ...(inhalt === null ? leistungVon(b, b.zeile.centProStunde) : (JSON.parse(inhalt) as Leistung)),
    contactId: b.kunde.externId ?? "",
  };
  const antwort = await leistungSenden(anschluss, leistung);
  const werte = antwort.ok
    ? { leistungId: antwort.wert.id, gesendetAm: kontext.jetzt, fehler: null, meldung: null }
    : { fehler: antwort.fehler, meldung: antwort.meldung || null };
  schreiben(deps.schreibDb, kontext, (s) =>
    s.aendern(
      "habenUebergaben",
      { buchungId: b.zeile.buchungId },
      { ...werte, inhalt: kanonisch(leistung), versuchtAm: kontext.jetzt },
    ),
  );
  return antwort.ok || !anHabenGescheitert(antwort.fehler);
};

/**
 * Hands bookings over to Haben as Leistungen (S-606), on demand of owner or planner: the ones not
 * billed yet are billed (and so locked) together with a note for Haben, then every one Haben has
 * not confirmed yet is sent, with the booking's id as `externalId`, so a repeat (a lost answer, a
 * second click, a retry after a failure) updates the same entry instead of adding one. Sending stops
 * at the first failure that concerns all calls (no answer, token refused, too many calls, a fault
 * of Haben); those bookings stay `wartet` and go with the next transfer.
 */
export const uebergeben = async (
  deps: HabenDeps,
  kontext: Kontext,
  ids: readonly string[],
): Promise<Antwort<UebergabeStand[]>> => {
  const anschluss = anschlussVon(deps.db, deps.schluessel, kontext.betriebId, deps.holen);
  if (!anschluss.ok) return anschluss;
  const gelesen = buchungenMitBezug(deps.db, kontext.betriebId, ids);
  if (!gelesen.ok) return gelesen;
  const abgelehnt =
    pruefen(deps.db, kontext.betriebId, gelesen.wert) ??
    abrechnenFuerHaben(deps, kontext, gelesen.wert);
  if (abgelehnt) return { ok: false, grund: abgelehnt };
  // read again: billing fixed the rate of each
  const frisch = buchungenMitBezug(deps.db, kontext.betriebId, ids);
  if (!frisch.ok) return frisch;
  const staende = staendeVon(deps.db, kontext.betriebId, frisch.wert);
  const offen = frisch.wert.filter((_, i) => staende[i]?.stand === "wartet");
  const notizen = uebergabenVon(
    deps.db,
    kontext.betriebId,
    offen.map((b) => b.zeile.buchungId),
  );
  for (const b of offen) {
    const inhalt = notizen.get(b.zeile.buchungId)?.inhalt ?? null;
    if (!(await senden(deps, kontext, anschluss.wert, b, inhalt))) break;
  }
  return { ok: true, wert: staendeVon(deps.db, kontext.betriebId, frisch.wert) };
};

/** A booking of an order as the transfer lists it: what it is, with its state towards Haben */
export type UebergabeZeile = UebergabeStand & {
  tag: string;
  beginn: number;
  ende: number;
  minuten: number;
  person: string;
  taetigkeit: string;
  notiz: string;
  abrechenbar: boolean;
};

/**
 * The finished bookings of an order in a span with their state towards Haben, and the contact its
 * customer is linked to (null: not linked, nothing can go)
 */
export const uebergabeListe = (
  db: Db,
  betriebId: string,
  auswahl: { projektId: string; von: string; bis: string },
): Antwort<{ kontaktId: string | null; buchungen: UebergabeZeile[] }> => {
  const gelesen = buchungenImAuftrag(db, betriebId, auswahl);
  if (!gelesen.ok) return gelesen;
  const staende = staendeVon(db, betriebId, gelesen.wert);
  const kundeId = projekteLesen(db, betriebId).find(
    (p) => p.projektId === auswahl.projektId,
  )?.kundeId;
  const kunde = kundenLesen(db, betriebId).find((k) => k.kundeId === kundeId);
  return {
    ok: true,
    wert: {
      kontaktId: kunde?.externQuelle === HABEN ? kunde.externId : null,
      buchungen: gelesen.wert.map((b, i) => ({
        ...(staende[i] as UebergabeStand),
        tag: b.zeile.tag,
        beginn: b.zeile.beginn,
        ende: b.zeile.ende ?? b.zeile.beginn,
        minuten: b.minuten,
        person: b.person,
        taetigkeit: b.taetigkeit,
        notiz: b.zeile.notiz,
        abrechenbar: b.abrechenbar,
      })),
    },
  };
};

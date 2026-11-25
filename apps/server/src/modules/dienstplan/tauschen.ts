import type { PlanBefund } from "@soll/arbeitszeit";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import type { Meldung } from "./meldungen.ts";
import { tauschBefunde } from "./pruefung.ts";
import { type Schicht, schichtLesen } from "./schichten.ts";
import {
  abgelaufen,
  istOffen,
  nochAngeboten,
  type Tausch,
  tauschMeldungen,
  ueberschneiden,
} from "./tausch.ts";
import {
  freigebende,
  kannUebernehmen,
  offeneTauscheDer,
  ohneFreigabe,
  schichtenDer,
  tauschLesen,
  uebernehmende,
} from "./tauschdaten.ts";

/*
 * The steps of a shift swap (S-504), each one write through the audit chain: offer, take over,
 * approve or refuse, withdraw. The shift changes its person only on approval, in the same
 * transaction as the swap; approval is a new notice under § 12 TzBfG (`veroeffentlicht_am`, S-503).
 */

export type TauschFehler =
  | "unbekannt"
  | "person_unbekannt"
  | "nicht_deine"
  | "nicht_fuer_dich"
  | "abgelaufen"
  | "hinfaellig"
  | "schon_angeboten"
  | "nicht_offen"
  | "ueberschneidung";

export type TauschErgebnis =
  | { ok: true; tausch: Tausch; meldungen: Meldung[] }
  | { ok: false; grund: TauschFehler };

const fehler = (grund: TauschFehler): TauschErgebnis => ({ ok: false, grund });

/**
 * Offers an own published shift that has not begun, to everyone who can take it (`anNutzerId`
 * null) or to one colleague. A draft is no shift of the person yet, so it is unknown here.
 */
export const tauschAnbieten = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { schichtId: string; anNutzerId: string | null },
): TauschErgebnis => {
  const { betriebId, akteur, jetzt } = kontext;
  const schicht = schichtLesen(db, betriebId, angaben.schichtId);
  if (!schicht || schicht.veroeffentlichtAm === null) return fehler("unbekannt");
  if (schicht.nutzerId !== akteur) return fehler("nicht_deine");
  if (abgelaufen(schicht, jetzt)) return fehler("abgelaufen");
  if (offeneTauscheDer(db, betriebId, schicht.schichtId).length > 0)
    return fehler("schon_angeboten");
  const an = angaben.anNutzerId;
  if (an !== null && (an === akteur || !kannUebernehmen(db, betriebId, an)))
    return fehler("person_unbekannt");
  const tausch = schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("schichttausche", {
      betriebId,
      tauschId: crypto.randomUUID(),
      schichtId: schicht.schichtId,
      anbieterId: akteur,
      anNutzerId: an,
      status: "offen",
      angebotenAm: jetzt,
    }),
  );
  const gemeint = an === null ? uebernehmende(db, betriebId).map(({ nutzerId }) => nutzerId) : [an];
  return {
    ok: true,
    tausch,
    meldungen: tauschMeldungen("angeboten", tausch, schicht, { gemeint }),
  };
};

/** The swap and its shift while it is still open and its shift as offered, else why not */
const offenerTausch = (
  db: Db,
  kontext: Kontext,
  tauschId: string,
): { ok: true; tausch: Tausch; schicht: Schicht } | { ok: false; grund: TauschFehler } => {
  const tausch = tauschLesen(db, kontext.betriebId, tauschId);
  if (!tausch) return { ok: false, grund: "unbekannt" };
  if (!istOffen(tausch)) return { ok: false, grund: "nicht_offen" };
  const schicht = schichtLesen(db, kontext.betriebId, tausch.schichtId);
  if (!schicht || !nochAngeboten(tausch, schicht)) return { ok: false, grund: "hinfaellig" };
  if (abgelaufen(schicht, kontext.jetzt)) return { ok: false, grund: "abgelaufen" };
  return { ok: true, tausch, schicht };
};

/** Whether a person already has a shift at the time of another */
const belegt = (
  db: Db,
  kontext: Kontext,
  nutzerId: string,
  schicht: Schicht,
  auchEntwuerfe = false,
) =>
  schichtenDer(db, kontext.betriebId, nutzerId, auchEntwuerfe).some(
    (andere) => andere.schichtId !== schicht.schichtId && ueberschneiden(andere, schicht),
  );

/** Approval: the shift goes to whoever took it, published anew, and the swap is decided */
const umschreiben = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  tausch: Tausch,
  uebernehmerId: string,
  entschiedenVon: string | null,
): Tausch =>
  schreiben(schreibDb, kontext, (s) => {
    s.aendern(
      "schichten",
      { schichtId: tausch.schichtId },
      { nutzerId: uebernehmerId, veroeffentlichtAm: kontext.jetzt },
    );
    return s.aendern(
      "schichttausche",
      { tauschId: tausch.tauschId },
      {
        status: "freigegeben",
        uebernehmerId,
        uebernommenAm: tausch.uebernommenAm ?? kontext.jetzt,
        entschiedenVon,
        entschiedenAm: kontext.jetzt,
      },
    );
  });

const hatVerstoss = (befunde: readonly PlanBefund[]) =>
  befunde.some((befund) => befund.schwere === "verstoss");

/**
 * Takes over an offer meant for the person. It waits for approval; a business that set "without
 * approval" swaps at once, unless the rules find a Verstoß for the person taking it.
 */
export const tauschUebernehmen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  tauschId: string,
): TauschErgebnis => {
  const { betriebId, akteur, jetzt } = kontext;
  const gelesen = tauschLesen(db, betriebId, tauschId);
  // an offer to someone else stays unknown to everybody but its parties
  const fremd =
    gelesen?.anNutzerId != null && gelesen.anNutzerId !== akteur && gelesen.anbieterId !== akteur;
  if (!gelesen || fremd) return fehler("unbekannt");
  if (gelesen.anbieterId === akteur || !kannUebernehmen(db, betriebId, akteur))
    return fehler("nicht_fuer_dich");
  const offen = offenerTausch(db, kontext, tauschId);
  if (!offen.ok) return offen;
  const { tausch, schicht } = offen;
  if (tausch.status !== "offen") return fehler("nicht_offen");
  if (belegt(db, kontext, akteur, schicht)) return fehler("ueberschneidung");
  const sofort =
    ohneFreigabe(db, betriebId) &&
    !hatVerstoss(tauschBefunde(db, betriebId, schicht, akteur, jetzt));
  if (sofort) {
    const getauscht = umschreiben(schreibDb, kontext, tausch, akteur, null);
    return {
      ok: true,
      tausch: getauscht,
      meldungen: tauschMeldungen("freigegeben", getauscht, schicht),
    };
  }
  const uebernommen = schreiben(schreibDb, kontext, (s) =>
    s.aendern(
      "schichttausche",
      { tauschId },
      { status: "uebernommen", uebernehmerId: akteur, uebernommenAm: jetzt },
    ),
  );
  return {
    ok: true,
    tausch: uebernommen,
    meldungen: tauschMeldungen("uebernommen", uebernommen, schicht, {
      freigebende: freigebende(db, betriebId),
    }),
  };
};

/** Owner or planner approve a swap that was taken over; the shift changes its person now */
export const tauschFreigeben = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  tauschId: string,
): TauschErgebnis => {
  const offen = offenerTausch(db, kontext, tauschId);
  if (!offen.ok) return offen;
  const { tausch, schicht } = offen;
  if (tausch.status !== "uebernommen" || tausch.uebernehmerId === null)
    return fehler("nicht_offen");
  // whoever took it may have left the business since
  if (!kannUebernehmen(db, kontext.betriebId, tausch.uebernehmerId))
    return fehler("person_unbekannt");
  if (belegt(db, kontext, tausch.uebernehmerId, schicht, true)) return fehler("ueberschneidung");
  const getauscht = umschreiben(schreibDb, kontext, tausch, tausch.uebernehmerId, kontext.akteur);
  return {
    ok: true,
    tausch: getauscht,
    meldungen: tauschMeldungen("freigegeben", getauscht, schicht),
  };
};

/** Owner or planner refuse an open swap, with a reason both parties read */
export const tauschAblehnen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  tauschId: string,
  grund: string,
): TauschErgebnis => {
  const offen = offenerTausch(db, kontext, tauschId);
  if (!offen.ok) return offen;
  const abgelehnt = schreiben(schreibDb, kontext, (s) =>
    s.aendern(
      "schichttausche",
      { tauschId },
      { status: "abgelehnt", grund, entschiedenVon: kontext.akteur, entschiedenAm: kontext.jetzt },
    ),
  );
  return {
    ok: true,
    tausch: abgelehnt,
    meldungen: tauschMeldungen("abgelehnt", abgelehnt, offen.schicht),
  };
};

/** Whoever offered a shift withdraws the offer while nobody decided it */
export const tauschZurueckziehen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  tauschId: string,
): TauschErgebnis => {
  const tausch = tauschLesen(db, kontext.betriebId, tauschId);
  if (!tausch) return fehler("unbekannt");
  if (tausch.anbieterId !== kontext.akteur) return fehler("nicht_deine");
  if (!istOffen(tausch)) return fehler("nicht_offen");
  const zurueck = schreiben(schreibDb, kontext, (s) =>
    s.aendern(
      "schichttausche",
      { tauschId },
      { status: "zurueckgezogen", entschiedenVon: kontext.akteur, entschiedenAm: kontext.jetzt },
    ),
  );
  const schicht = schichtLesen(db, kontext.betriebId, tausch.schichtId);
  return {
    ok: true,
    tausch: zurueck,
    meldungen: schicht ? tauschMeldungen("zurueckgezogen", zurueck, schicht) : [],
  };
};

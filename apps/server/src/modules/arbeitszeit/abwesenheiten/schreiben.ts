import {
  type Abwesenheitsart,
  GESUNDHEIT,
  plusTage,
  type Tag,
  tageZwischen,
  tagInBerlin,
  ueberschneiden,
  ueberschneidungErlaubt,
} from "@soll/arbeitszeit";
import type { Db, SchreibDb } from "../../../db/oeffnen.ts";
import { type Kontext, schreiben } from "../../audit/index.ts";
import { type AbwesenheitZeile, AKTIV, abwesenheitenIn, abwesenheitLesen } from "./lesen.ts";
import { abwesenheitGesperrt } from "./sperre.ts";

/*
 * Requests, decisions and sickness reports (S-401), each a write through the audit chain. A change
 * that would alter a day of a closed month is refused (`abgeschlossen`), the correction is a
 * counter-entry (S-306).
 */

export type AbwesenheitFehler =
  | "ungueltig"
  | "unbekannt"
  | "keine_berechtigung"
  | "status"
  | "ueberschneidung"
  | "abgeschlossen";

export type AbwesenheitErgebnis =
  | { ok: true; zeile: AbwesenheitZeile; vorher: AbwesenheitZeile | null }
  | { ok: false; grund: AbwesenheitFehler };

/** What the caller may do beyond their own absences (auth/rollen.ts) */
export type Rechte = { freigeben: boolean; gesundheit: boolean };

/** A request spans at most a year: anything longer is a typo, not leave */
const LAENGSTENS_TAGE = 366;

export type Antrag = {
  nutzerId: string;
  art: Exclude<Abwesenheitsart, "krank" | "kind_krank">;
  von: Tag;
  bis: Tag;
  ersterHalb: boolean;
  letzterHalb: boolean;
};

export type Krankmeldung = {
  nutzerId: string;
  art: "krank" | "kind_krank";
  bis: Tag | null;
  kind: string | null;
};

const fehler = (grund: AbwesenheitFehler): AbwesenheitErgebnis => ({ ok: false, grund });

/**
 * Whether a new span collides with a request or absence in force of the person (§ 9 BUrlG aside).
 * An open end reaches to today only: a sickness whose end is not known does not block a day off
 * planned for later, nor that a day off is planned while one is sick (docs/plan.md,
 * "Überschneidungen"); until its end is known it gives way to it (`tageDerAbwesenheiten`).
 */
const ueberschneidet = (
  db: Db,
  betriebId: string,
  neu: { nutzerId: string; art: Abwesenheitsart; von: Tag; bis: Tag | null; abwesenheitId: string },
  heute: Tag,
): boolean => {
  const bekannt = <T extends { von: Tag; bis: Tag | null }>(z: T) => ({
    ...z,
    bis: z.bis ?? (heute < z.von ? z.von : heute),
  });
  const span = bekannt(neu);
  return abwesenheitenIn(db, betriebId, {
    nutzerId: neu.nutzerId,
    von: span.von,
    bis: span.bis,
    status: AKTIV,
  }).some(
    (alt) =>
      alt.abwesenheitId !== neu.abwesenheitId &&
      ueberschneiden(bekannt(alt), span) &&
      !ueberschneidungErlaubt(alt.art, neu.art),
  );
};

const neueZeile = (
  kontext: Kontext,
  werte: Pick<
    AbwesenheitZeile,
    "nutzerId" | "art" | "von" | "bis" | "ersterHalb" | "letzterHalb" | "status" | "kind"
  >,
): AbwesenheitZeile => ({
  betriebId: kontext.betriebId,
  abwesenheitId: crypto.randomUUID(),
  ...werte,
  bescheinigung: null,
  grund: null,
  entschiedenVon: null,
  entschiedenAm: null,
  erstelltVon: kontext.akteur,
  erstelltAm: kontext.jetzt,
});

const einfuegen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  zeile: AbwesenheitZeile,
  auchAntrag: boolean,
): AbwesenheitErgebnis => {
  const heute = tagInBerlin(kontext.jetzt);
  if (ueberschneidet(db, kontext.betriebId, zeile, heute)) return fehler("ueberschneidung");
  if (
    abwesenheitGesperrt(db, kontext.betriebId, zeile.nutzerId, {
      vorher: null,
      nachher: zeile,
      heute,
      auchAntrag,
    })
  )
    return fehler("abgeschlossen");
  const neu = schreiben(schreibDb, kontext, (s) => s.einfuegen("abwesenheiten", zeile));
  return { ok: true, zeile: neu, vorher: null };
};

/**
 * A request for leave, Sonderurlaub or taking off overtime (BAULISTE.md S-401): whole days, the
 * first and the last one may be half; it counts once the business approves it
 */
export const beantragen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  antrag: Antrag,
): AbwesenheitErgebnis => {
  if (antrag.bis < antrag.von || tageZwischen(antrag.von, antrag.bis) >= LAENGSTENS_TAGE)
    return fehler("ungueltig");
  return einfuegen(
    db,
    schreibDb,
    kontext,
    neueZeile(kontext, { ...antrag, status: "beantragt", kind: null }),
    true,
  );
};

/**
 * A sickness, one's own or a child's, reported from today on, without a diagnosis (Art. 9 DSGVO);
 * it counts at once. The end may stay open until it is known. A child is named only by a short id.
 */
export const krankMelden = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  meldung: Krankmeldung,
): AbwesenheitErgebnis => {
  const heute = tagInBerlin(kontext.jetzt);
  if (
    meldung.bis !== null &&
    (meldung.bis < heute || tageZwischen(heute, meldung.bis) >= LAENGSTENS_TAGE)
  )
    return fehler("ungueltig");
  if ((meldung.art === "kind_krank") !== (meldung.kind !== null)) return fehler("ungueltig");
  return einfuegen(
    db,
    schreibDb,
    kontext,
    neueZeile(kontext, {
      nutzerId: meldung.nutzerId,
      art: meldung.art,
      von: heute,
      bis: meldung.bis,
      ersterHalb: false,
      letzterHalb: false,
      status: "genehmigt",
      kind: meldung.kind,
    }),
    false,
  );
};

/** Changes a row through the chain, refused when it would alter a day of a closed month */
const aendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  vorher: AbwesenheitZeile,
  werte: Partial<AbwesenheitZeile>,
): AbwesenheitErgebnis => {
  const nachher = { ...vorher, ...werte };
  const heute = tagInBerlin(kontext.jetzt);
  if (abwesenheitGesperrt(db, kontext.betriebId, vorher.nutzerId, { vorher, nachher, heute }))
    return fehler("abgeschlossen");
  const zeile = schreiben(schreibDb, kontext, (s) =>
    s.aendern("abwesenheiten", { abwesenheitId: vorher.abwesenheitId }, werte),
  );
  return { ok: true, zeile, vorher };
};

export type Entscheidung =
  | { aktion: "freigeben" }
  | { aktion: "ablehnen"; grund: string }
  | { aktion: "zurueckziehen" }
  | { aktion: "stornieren"; grund: string };

const gesundheit = (zeile: AbwesenheitZeile) => GESUNDHEIT.has(zeile.art);

/** Whether the caller may take the step on the row, and from which state */
const erlaubt = (
  zeile: AbwesenheitZeile,
  entscheidung: Entscheidung,
  wer: { nutzerId: string; rechte: Rechte },
): AbwesenheitFehler | null => {
  const eigen = zeile.nutzerId === wer.nutzerId;
  const regel = {
    // the person withdraws a request not decided yet
    zurueckziehen: { darf: eigen && !gesundheit(zeile), von: "beantragt" },
    // owner and planner decide on requests
    freigeben: { darf: wer.rechte.freigeben && !gesundheit(zeile), von: "beantragt" },
    ablehnen: { darf: wer.rechte.freigeben && !gesundheit(zeile), von: "beantragt" },
    // approved leave is cancelled by the business with a reason; a sickness reported by mistake
    // only by whoever may see it
    stornieren: {
      darf: gesundheit(zeile) ? wer.rechte.gesundheit : wer.rechte.freigeben,
      von: "genehmigt",
    },
  }[entscheidung.aktion];
  if (!regel.darf) return "keine_berechtigung";
  return zeile.status === regel.von ? null : "status";
};

const NACH = {
  freigeben: "genehmigt",
  ablehnen: "abgelehnt",
  zurueckziehen: "zurueckgezogen",
  stornieren: "storniert",
} as const;

/** Approve, refuse, withdraw or cancel an absence */
export const entscheiden = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  abwesenheitId: string,
  entscheidung: Entscheidung,
  rechte: Rechte,
): AbwesenheitErgebnis => {
  const zeile = abwesenheitLesen(db, kontext.betriebId, abwesenheitId);
  if (!zeile) return fehler("unbekannt");
  const nein = erlaubt(zeile, entscheidung, { nutzerId: kontext.akteur, rechte });
  if (nein) return fehler(nein);
  return aendern(db, schreibDb, kontext, zeile, {
    status: NACH[entscheidung.aktion],
    grund: "grund" in entscheidung ? entscheidung.grund : null,
    entschiedenVon: kontext.akteur,
    entschiedenAm: kontext.jetzt,
  });
};

/** A sickness of one's own, or whoever may see sickness (rollen.ts), in force */
const krankheitFuer = (
  db: Db,
  kontext: Kontext,
  abwesenheitId: string,
  rechte: Rechte,
): AbwesenheitZeile | AbwesenheitFehler => {
  const zeile = abwesenheitLesen(db, kontext.betriebId, abwesenheitId);
  if (!zeile) return "unbekannt";
  if (!gesundheit(zeile)) return "ungueltig";
  if (zeile.nutzerId !== kontext.akteur && !rechte.gesundheit) return "keine_berechtigung";
  return zeile.status === "genehmigt" ? zeile : "status";
};

/**
 * „Bescheinigung liegt vor“: as an eAU the business fetched, or on paper in the office; never the
 * certificate itself (docs/plan.md, "Bescheinigungen"). null takes the mark back.
 */
export const bescheinigungSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  abwesenheitId: string,
  bescheinigung: "eau" | "papier" | null,
  rechte: Rechte,
): AbwesenheitErgebnis => {
  const zeile = krankheitFuer(db, kontext, abwesenheitId, rechte);
  if (typeof zeile === "string") return fehler(zeile);
  return aendern(db, schreibDb, kontext, zeile, { bescheinigung });
};

/** The last day of a sickness, once it is known */
export const krankheitBeenden = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  abwesenheitId: string,
  bis: Tag,
  rechte: Rechte,
): AbwesenheitErgebnis => {
  const zeile = krankheitFuer(db, kontext, abwesenheitId, rechte);
  if (typeof zeile === "string") return fehler(zeile);
  if (bis < zeile.von || bis > plusTage(zeile.von, LAENGSTENS_TAGE - 1)) return fehler("ungueltig");
  const heute = tagInBerlin(kontext.jetzt);
  if (ueberschneidet(db, kontext.betriebId, { ...zeile, bis }, heute))
    return fehler("ueberschneidung");
  return aendern(db, schreibDb, kontext, zeile, { bis });
};

import { type Stempelart, tagInBerlin } from "@soll/arbeitszeit";
import { and, eq, gte, isNotNull, isNull, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { stempelungen } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { monatAbgeschlossen } from "./abschluss.ts";

type Zeile = typeof stempelungen.$inferSelect;
export type Quelle = Zeile["quelle"];

/** A stamp in force as the API shows it; `korrigiert` when a person entered or changed it by hand */
export type Stempel = Pick<
  Zeile,
  "stempelId" | "nutzerId" | "art" | "zeitpunkt" | "geraetZeitpunkt" | "quelle"
> & { korrigiert: boolean };

const alsStempel = (zeile: Zeile): Stempel => ({
  stempelId: zeile.stempelId,
  nutzerId: zeile.nutzerId,
  art: zeile.art,
  zeitpunkt: zeile.zeitpunkt,
  geraetZeitpunkt: zeile.geraetZeitpunkt,
  quelle: zeile.quelle,
  korrigiert: zeile.grund !== null,
});

const nachfolger = alias(stempelungen, "nachfolger");

/** A row is in force while no row replaces it and it removes nothing */
const inKraft = and(isNull(nachfolger.stempelId), eq(stempelungen.entfernt, false));
const mitNachfolger = and(
  eq(nachfolger.betriebId, stempelungen.betriebId),
  eq(nachfolger.ersetzt, stempelungen.stempelId),
);

/** The stamps in force of a person from `von` to before `bis` (UTC milliseconds), in time order */
export const stempelungenIn = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: number,
  bis: number,
): Stempel[] =>
  db
    .select({ zeile: stempelungen })
    .from(stempelungen)
    .leftJoin(nachfolger, mitNachfolger)
    .where(
      and(
        eq(stempelungen.betriebId, betriebId),
        eq(stempelungen.nutzerId, nutzerId),
        gte(stempelungen.zeitpunkt, von),
        lt(stempelungen.zeitpunkt, bis),
        inKraft,
      ),
    )
    .orderBy(stempelungen.zeitpunkt)
    .all()
    .map(({ zeile }) => alsStempel(zeile));

/** A stamp of the business that is in force, by its id */
export const stempelInKraft = (db: Db, betriebId: string, stempelId: string): Zeile | undefined =>
  db
    .select({ zeile: stempelungen })
    .from(stempelungen)
    .leftJoin(nachfolger, mitNachfolger)
    .where(
      and(eq(stempelungen.betriebId, betriebId), eq(stempelungen.stempelId, stempelId), inKraft),
    )
    .get()?.zeile;

type Neu = Omit<Zeile, "betriebId" | "stempelId" | "erstelltVon" | "erstelltAm" | "entfernt"> & {
  entfernt?: boolean;
};

const einfuegen = (schreibDb: SchreibDb, kontext: Kontext, neu: Neu): Zeile =>
  schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("stempelungen", {
      ...neu,
      betriebId: kontext.betriebId,
      stempelId: crypto.randomUUID(),
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
    }),
  );

const gesperrt = (db: Db, betriebId: string, nutzerId: string, ...zeitpunkte: number[]) =>
  zeitpunkte.some((zeitpunkt) =>
    monatAbgeschlossen(db, betriebId, nutzerId, tagInBerlin(zeitpunkt)),
  );

export type StempelErgebnis =
  | { ok: true; stempel: Stempel }
  | {
      ok: false;
      grund: "abgeschlossen" | "unbekannt" | "keine_berechtigung" | "zukunft" | "veraltet";
    };

/**
 * A live stamp of the person who is signed in: the server's clock decides its instant (S-304), the
 * device's clock is kept beside it. Any kind is taken, also one that does not fit the state: an
 * offline queue may deliver late (S-305), and R-01 reports what does not fit; nothing is refused or
 * guessed.
 */
export const stempeln = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { art: Stempelart; geraetZeitpunkt: number | null; quelle: Quelle },
): StempelErgebnis => {
  if (gesperrt(db, kontext.betriebId, kontext.akteur, kontext.jetzt))
    return { ok: false, grund: "abgeschlossen" };
  const zeile = einfuegen(schreibDb, kontext, {
    nutzerId: kontext.akteur,
    art: angaben.art,
    zeitpunkt: kontext.jetzt,
    geraetZeitpunkt: angaben.geraetZeitpunkt,
    quelle: angaben.quelle,
    ersetzt: null,
    grund: null,
  });
  return { ok: true, stempel: alsStempel(zeile) };
};

/** A stamp added by hand, with its reason; never in the future, never in a closed month */
export const nachtragen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { nutzerId: string; art: Stempelart; zeitpunkt: number; grund: string },
): StempelErgebnis => {
  if (angaben.zeitpunkt > kontext.jetzt) return { ok: false, grund: "zukunft" };
  if (gesperrt(db, kontext.betriebId, angaben.nutzerId, angaben.zeitpunkt))
    return { ok: false, grund: "abgeschlossen" };
  const zeile = einfuegen(schreibDb, kontext, {
    nutzerId: angaben.nutzerId,
    art: angaben.art,
    zeitpunkt: angaben.zeitpunkt,
    geraetZeitpunkt: null,
    quelle: "app",
    ersetzt: null,
    grund: angaben.grund,
  });
  return { ok: true, stempel: alsStempel(zeile) };
};

/** Two changes of one version at once: the unique index on `ersetzt` lets only the first through */
const zweiterWechsel = (fehler: unknown): boolean =>
  /UNIQUE constraint failed: stempelungen\.betrieb_id, stempelungen\.ersetzt/.test(String(fehler));

type Ersetzen = {
  stempelId: string;
  grund: string;
  /** whether the caller may correct the stamps of others (owner, planner) */
  fuerAndere: boolean;
};

/**
 * Appends a row that replaces a stamp in force: a change with a new kind and instant, or a removal.
 * The stamp replaced stays as it was (docs/plan.md, "Änderungen an Stempelungen").
 */
const ersetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: Ersetzen & { art?: Stempelart; zeitpunkt?: number; entfernt: boolean },
): StempelErgebnis => {
  const alt = stempelInKraft(db, kontext.betriebId, angaben.stempelId);
  if (!alt) return { ok: false, grund: "unbekannt" };
  if (alt.nutzerId !== kontext.akteur && !angaben.fuerAndere)
    return { ok: false, grund: "keine_berechtigung" };
  const zeitpunkt = angaben.zeitpunkt ?? alt.zeitpunkt;
  if (zeitpunkt > kontext.jetzt) return { ok: false, grund: "zukunft" };
  if (gesperrt(db, kontext.betriebId, alt.nutzerId, alt.zeitpunkt, zeitpunkt))
    return { ok: false, grund: "abgeschlossen" };
  try {
    const zeile = einfuegen(schreibDb, kontext, {
      nutzerId: alt.nutzerId,
      art: angaben.art ?? alt.art,
      zeitpunkt,
      geraetZeitpunkt: null,
      quelle: alt.quelle,
      ersetzt: alt.stempelId,
      entfernt: angaben.entfernt,
      grund: angaben.grund,
    });
    return { ok: true, stempel: alsStempel(zeile) };
  } catch (fehler) {
    if (zweiterWechsel(fehler)) return { ok: false, grund: "veraltet" };
    throw fehler;
  }
};

export const stempelAendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: Ersetzen & { art: Stempelart; zeitpunkt: number },
): StempelErgebnis => ersetzen(db, schreibDb, kontext, { ...angaben, entfernt: false });

export const stempelEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: Ersetzen,
): StempelErgebnis => ersetzen(db, schreibDb, kontext, { ...angaben, entfernt: true });

/** What a person sees of a change to their times: who, when, what before and after, and why */
export type Aenderung = {
  stempelId: string;
  aktion: "nachgetragen" | "geaendert" | "entfernt";
  vorher: { art: Stempelart; zeitpunkt: number } | null;
  nachher: { art: Stempelart; zeitpunkt: number } | null;
  grund: string;
  von: string;
  am: number;
};

const vorgaenger = alias(stempelungen, "vorgaenger");

const alsAenderung = (zeile: Zeile, vorher: Zeile | null): Aenderung => ({
  stempelId: zeile.stempelId,
  aktion: vorher === null ? "nachgetragen" : zeile.entfernt ? "entfernt" : "geaendert",
  vorher: vorher === null ? null : { art: vorher.art, zeitpunkt: vorher.zeitpunkt },
  nachher: zeile.entfernt ? null : { art: zeile.art, zeitpunkt: zeile.zeitpunkt },
  grund: zeile.grund ?? "",
  von: zeile.erstelltVon,
  am: zeile.erstelltAm,
});

/**
 * Every change by hand to a person's stamps whose instant before or after lies from `von` to before
 * `bis`, in the order they were made
 */
export const aenderungenIn = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: number,
  bis: number,
): Aenderung[] =>
  db
    .select({ zeile: stempelungen, vorher: vorgaenger })
    .from(stempelungen)
    .leftJoin(
      vorgaenger,
      and(
        eq(vorgaenger.betriebId, stempelungen.betriebId),
        eq(vorgaenger.stempelId, stempelungen.ersetzt),
      ),
    )
    .where(
      and(
        eq(stempelungen.betriebId, betriebId),
        eq(stempelungen.nutzerId, nutzerId),
        isNotNull(stempelungen.grund),
        or(
          and(gte(stempelungen.zeitpunkt, von), lt(stempelungen.zeitpunkt, bis)),
          and(gte(vorgaenger.zeitpunkt, von), lt(vorgaenger.zeitpunkt, bis)),
        ),
      ),
    )
    .orderBy(stempelungen.erstelltAm)
    .all()
    .map(({ zeile, vorher }) => alsAenderung(zeile, vorher));

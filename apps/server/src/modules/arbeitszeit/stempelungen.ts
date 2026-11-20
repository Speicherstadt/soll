import { offlineZeitpunkt, type Stempelart, type Stempelung } from "@soll/arbeitszeit";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { stempelungen } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { aenderungGesperrt } from "./abschluss.ts";

type Zeile = typeof stempelungen.$inferSelect;
export type Quelle = Zeile["quelle"];

/**
 * A stamp in force as the API shows it; `korrigiert` when a person entered or changed it by hand,
 * `offline` when it came late from a device's queue (its instant is the device's), `nummer` its
 * number on the device (S-305)
 */
export type Stempel = Pick<
  Zeile,
  | "stempelId"
  | "nutzerId"
  | "art"
  | "zeitpunkt"
  | "geraetZeitpunkt"
  | "quelle"
  | "offline"
  | "nummer"
> & { korrigiert: boolean };

const alsStempel = (zeile: Zeile): Stempel => ({
  stempelId: zeile.stempelId,
  nutzerId: zeile.nutzerId,
  art: zeile.art,
  zeitpunkt: zeile.zeitpunkt,
  geraetZeitpunkt: zeile.geraetZeitpunkt,
  quelle: zeile.quelle,
  offline: zeile.offline,
  nummer: zeile.nummer,
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

/** Whether a person has any stamp in the business, also one who left or no longer stamps */
export const hatStempelungen = (db: Db, betriebId: string, nutzerId: string): boolean =>
  db
    .select({ id: stempelungen.stempelId })
    .from(stempelungen)
    .where(and(eq(stempelungen.betriebId, betriebId), eq(stempelungen.nutzerId, nutzerId)))
    .limit(1)
    .get() !== undefined;

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

type Optional = "entfernt" | "geraetId" | "nummer" | "signatur" | "offline";
type Neu = Omit<Zeile, "betriebId" | "stempelId" | "erstelltVon" | "erstelltAm" | Optional> &
  Partial<Pick<Zeile, Optional>>;

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

/**
 * Whether a change would touch a month closed for the person (S-306): `weg` leaves force, `neu`
 * comes in. The stamps around are read only when a month is closed.
 */
const gesperrt = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  aenderung: { weg?: Zeile; neu?: Stempelung | undefined },
): boolean => {
  const zeitpunkte = [aenderung.weg?.zeitpunkt, aenderung.neu?.zeitpunkt].filter(
    (zeitpunkt): zeitpunkt is number => zeitpunkt !== undefined,
  );
  return aenderungGesperrt(db, betriebId, nutzerId, {
    zeitpunkte,
    vorher: (von, bis) => stempelungenIn(db, betriebId, nutzerId, von, bis),
    nachher: (vorher) => [
      ...vorher.filter((stempel) => stempel.stempelId !== aenderung.weg?.stempelId),
      ...(aenderung.neu ? [aenderung.neu] : []),
    ],
  });
};

export type StempelErgebnis =
  /** `vorhanden`: the same entry of a device's queue came again and changed nothing (S-305) */
  | { ok: true; stempel: Stempel; vorhanden?: true }
  | {
      ok: false;
      grund:
        | "abgeschlossen"
        | "unbekannt"
        | "keine_berechtigung"
        | "zukunft"
        | "veraltet"
        | "doppelt";
    };

/** An entry of a device's offline queue, already checked against the device's key (geraete.ts) */
export type Signiert = { geraetId: string; nummer: number; signatur: string };

/** The row of a device's number, an original (corrections carry no device) */
const nummerLesen = (db: Db, betriebId: string, geraetId: string, nummer: number) =>
  db
    .select()
    .from(stempelungen)
    .where(
      and(
        eq(stempelungen.betriebId, betriebId),
        eq(stempelungen.geraetId, geraetId),
        eq(stempelungen.nummer, nummer),
      ),
    )
    .get();

/**
 * A number of a device that has arrived before: the same entry again (the answer was lost on the
 * way) changes nothing; another entry under the same number is refused (docs/plan.md,
 * "Offline-Stempeln")
 */
const schonDa = (
  db: Db,
  betriebId: string,
  signiert: Signiert | undefined,
  inhalt: { art: Stempelart; geraetZeitpunkt: number | null },
): StempelErgebnis | null => {
  if (!signiert) return null;
  const alt = nummerLesen(db, betriebId, signiert.geraetId, signiert.nummer);
  if (!alt) return null;
  return alt.art === inhalt.art && alt.geraetZeitpunkt === inhalt.geraetZeitpunkt
    ? { ok: true, stempel: alsStempel(alt), vorhanden: true }
    : { ok: false, grund: "doppelt" };
};

/**
 * A live stamp of the person who is signed in: the server's clock decides its instant (S-304), the
 * device's clock is kept beside it. Any kind is taken, also one that does not fit the state: an
 * offline queue may deliver late (S-305), and R-01 reports what does not fit; nothing is refused or
 * guessed. A stamp signed by a device keeps its number, so the numbers of the device stay without
 * gaps whether an entry went live or through the queue.
 */
export const stempeln = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: {
    art: Stempelart;
    geraetZeitpunkt: number | null;
    quelle: Quelle;
    signiert?: Signiert | undefined;
  },
): StempelErgebnis => {
  const vorher = schonDa(db, kontext.betriebId, angaben.signiert, angaben);
  if (vorher) return vorher;
  if (
    gesperrt(db, kontext.betriebId, kontext.akteur, {
      neu: { art: angaben.art, zeitpunkt: kontext.jetzt },
    })
  )
    return { ok: false, grund: "abgeschlossen" };
  const zeile = einfuegen(schreibDb, kontext, {
    nutzerId: kontext.akteur,
    art: angaben.art,
    zeitpunkt: kontext.jetzt,
    geraetZeitpunkt: angaben.geraetZeitpunkt,
    quelle: angaben.quelle,
    ersetzt: null,
    grund: null,
    ...angaben.signiert,
  });
  return { ok: true, stempel: alsStempel(zeile) };
};

/**
 * An entry of a device's queue that arrives late (S-305): its instant is the device's, moved by the
 * error of the device's clock (`offlineZeitpunkt`), and it is marked offline; the server's clock at
 * receipt is `erstellt_am`. Never in a closed month, never in the future.
 */
export const offlineStempeln = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: {
    art: Stempelart;
    geraetZeitpunkt: number;
    gesendetAm: number;
    quelle: Quelle;
    signiert: Signiert;
  },
): StempelErgebnis => {
  const vorher = schonDa(db, kontext.betriebId, angaben.signiert, angaben);
  if (vorher) return vorher;
  const zeit = offlineZeitpunkt({ ...angaben, empfangen: kontext.jetzt });
  if (!zeit.ok) return { ok: false, grund: "zukunft" };
  if (
    gesperrt(db, kontext.betriebId, kontext.akteur, {
      neu: { art: angaben.art, zeitpunkt: zeit.zeitpunkt },
    })
  )
    return { ok: false, grund: "abgeschlossen" };
  const zeile = einfuegen(schreibDb, kontext, {
    nutzerId: kontext.akteur,
    art: angaben.art,
    zeitpunkt: zeit.zeitpunkt,
    geraetZeitpunkt: angaben.geraetZeitpunkt,
    quelle: angaben.quelle,
    ersetzt: null,
    grund: null,
    offline: true,
    ...angaben.signiert,
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
  if (gesperrt(db, kontext.betriebId, angaben.nutzerId, { neu: angaben }))
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
  const art = angaben.art ?? alt.art;
  const neu = angaben.entfernt ? undefined : { art, zeitpunkt };
  if (gesperrt(db, kontext.betriebId, alt.nutzerId, { weg: alt, neu }))
    return { ok: false, grund: "abgeschlossen" };
  try {
    const zeile = einfuegen(schreibDb, kontext, {
      nutzerId: alt.nutzerId,
      art,
      zeitpunkt,
      geraetZeitpunkt: null,
      quelle: alt.quelle,
      // the instant still comes from the device while a correction keeps it
      offline: alt.offline && zeitpunkt === alt.zeitpunkt,
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

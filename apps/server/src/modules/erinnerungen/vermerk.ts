import { randomUUID } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { erinnerungen } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { type Art, schluesselVon } from "./faellig.ts";

/** How far back a reminder can matter: a shift lasts at most a day, a month is asked once */
const RUECKBLICK = 40 * 24 * 60 * 60 * 1000;

/** The keys of the reminders the business sent lately (`schluesselVon`) */
export const erinnertIn = (db: Db, betriebId: string, jetzt: number): Set<string> =>
  new Set(
    db
      .select()
      .from(erinnerungen)
      .where(
        and(
          eq(erinnerungen.betriebId, betriebId),
          gte(erinnerungen.erstelltAm, jetzt - RUECKBLICK),
        ),
      )
      .all()
      .map(schluesselVon),
  );

/** SQLite's refusal by the unique index, also when Drizzle wraps it as the cause */
const doppelt = (fehler: unknown): boolean =>
  /UNIQUE constraint failed/.test(
    `${String(fehler)} ${String((fehler as { cause?: unknown } | null)?.cause ?? "")}`,
  );

/**
 * Notes a reminder before it is sent; false when it was noted already (also by a second loop at
 * the same time: the unique index decides), so it goes out at most once
 */
export const vermerken = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  e: { nutzerId: string; art: Art; bezug: string },
): boolean => {
  try {
    schreiben(schreibDb, kontext, (s) =>
      s.einfuegen("erinnerungen", {
        betriebId: kontext.betriebId,
        erinnerungId: randomUUID(),
        nutzerId: e.nutzerId,
        art: e.art,
        bezug: e.bezug,
        erstelltAm: kontext.jetzt,
      }),
    );
    return true;
  } catch (fehler) {
    if (doppelt(fehler)) return false;
    throw fehler;
  }
};

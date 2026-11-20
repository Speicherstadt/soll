import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { schichtvorlagen } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

export type Vorlage = typeof schichtvorlagen.$inferSelect;

/** What a template holds: times on the Berlin clock, break and role (S-501) */
export type VorlageAngaben = {
  name: string;
  beginnMinute: number;
  endeMinute: number;
  pauseMinuten: number;
  rolle: string;
  standortId: string | null;
};

const dieser = (betriebId: string, vorlageId: string) =>
  and(eq(schichtvorlagen.betriebId, betriebId), eq(schichtvorlagen.vorlageId, vorlageId));

export const vorlagenLesen = (db: Db, betriebId: string): Vorlage[] =>
  db
    .select()
    .from(schichtvorlagen)
    .where(eq(schichtvorlagen.betriebId, betriebId))
    .orderBy(schichtvorlagen.beginnMinute, schichtvorlagen.name)
    .all();

export const vorlageLesen = (db: Db, betriebId: string, vorlageId: string): Vorlage | undefined =>
  db.select().from(schichtvorlagen).where(dieser(betriebId, vorlageId)).get();

export const vorlageAnlegen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: VorlageAngaben,
): Vorlage =>
  schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("schichtvorlagen", {
      betriebId: kontext.betriebId,
      vorlageId: crypto.randomUUID(),
      ...angaben,
      angelegtAm: kontext.jetzt,
    }),
  );

/** Changes a template; the shifts planned from it keep their times (they are their own rows) */
export const vorlageAendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  vorlageId: string,
  angaben: VorlageAngaben,
): Vorlage | undefined => {
  if (!vorlageLesen(db, kontext.betriebId, vorlageId)) return undefined;
  return schreiben(schreibDb, kontext, (s) => s.aendern("schichtvorlagen", { vorlageId }, angaben));
};

export const vorlageEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  vorlageId: string,
): boolean => {
  if (!vorlageLesen(db, kontext.betriebId, vorlageId)) return false;
  schreiben(schreibDb, kontext, (s) => s.loeschen("schichtvorlagen", { vorlageId }));
  return true;
};

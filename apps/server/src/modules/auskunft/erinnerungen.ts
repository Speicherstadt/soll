import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { erinnerungen, erinnerungseinstellungen, pushAbos } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The person's reminders (S-307): which they want, which went out, and the devices that receive
 * them. A device's subscription (endpoint and keys) stays out: whoever holds it can write to the
 * device, so it is a secret (CLAUDE.md), and the person has it on the device already.
 */

const wuenscheVon = (db: Db, betriebId: string, nutzerId: string) => {
  const zeile = db
    .select()
    .from(erinnerungseinstellungen)
    .where(
      and(
        eq(erinnerungseinstellungen.betriebId, betriebId),
        eq(erinnerungseinstellungen.nutzerId, nutzerId),
      ),
    )
    .get();
  return zeile
    ? { ausstempeln: zeile.ausstempeln, pause: zeile.pause, monat: zeile.monat, mail: zeile.mail }
    : null;
};

const gesendetVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(erinnerungen)
    .where(and(eq(erinnerungen.betriebId, betriebId), eq(erinnerungen.nutzerId, nutzerId)))
    .orderBy(erinnerungen.erstelltAm)
    .all()
    .map((z) => ({
      erinnerungId: z.erinnerungId,
      art: z.art,
      bezug: z.bezug,
      am: iso(z.erstelltAm),
    }));

const abosVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(pushAbos)
    .where(and(eq(pushAbos.betriebId, betriebId), eq(pushAbos.nutzerId, nutzerId)))
    .all()
    .map((z) => ({ aboId: z.aboId, sprache: z.sprache, angelegtAm: iso(z.angelegtAm) }));

export const erinnerungsteil = (db: Db, betriebId: string, nutzerId: string) => ({
  /** null: no choice made, so every reminder with mail as a fallback */
  erinnerungseinstellungen: wuenscheVon(db, betriebId, nutzerId),
  erinnerungen: gesendetVon(db, betriebId, nutzerId),
  pushAbos: abosVon(db, betriebId, nutzerId),
});

export type Erinnerungsteil = ReturnType<typeof erinnerungsteil>;

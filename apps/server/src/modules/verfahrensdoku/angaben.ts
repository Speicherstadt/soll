import { type Angaben, type EigenerAbschnitt, LEERE_ANGABEN } from "@soll/export";
import { and, asc, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { auditGlieder, verfahrensdokuAngaben } from "../../db/schema.ts";
import { type Kontext, schreiben, zeilenId } from "../audit/index.ts";

/*
 * The business's statements for its Verfahrensdokumentation (S-902): one row per business, written
 * only through the audit chain, so every saved version stays traceable (GoBD Rz. 154).
 */

const ausZeile = (zeile: typeof verfahrensdokuAngaben.$inferSelect): Angaben => ({
  rechtsform: zeile.rechtsform,
  anschrift: zeile.anschrift,
  verantwortlich: zeile.verantwortlich,
  aufbewahrungsort: zeile.aufbewahrungsort,
  serverbetrieb: zeile.serverbetrieb,
  datensicherung: zeile.datensicherung,
  schluesselablage: zeile.schluesselablage,
  eigene: JSON.parse(zeile.eigene) as EigenerAbschnitt[],
});

/** The statements of a business; empty ones while it has saved none */
export const angabenLesen = (db: Db, betriebId: string): Angaben => {
  const zeile = db
    .select()
    .from(verfahrensdokuAngaben)
    .where(eq(verfahrensdokuAngaben.betriebId, betriebId))
    .get();
  return zeile ? ausZeile(zeile) : LEERE_ANGABEN;
};

/** Saves all statements at once; the first save inserts the row, each further one changes it */
export const angabenSpeichern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: Angaben,
): Angaben => {
  const { eigene, ...felder } = angaben;
  const werte = { ...felder, eigene: JSON.stringify(eigene), geaendertAm: kontext.jetzt };
  const vorhanden = db
    .select({ betriebId: verfahrensdokuAngaben.betriebId })
    .from(verfahrensdokuAngaben)
    .where(eq(verfahrensdokuAngaben.betriebId, kontext.betriebId))
    .get();
  const zeile = schreiben(schreibDb, kontext, (s) =>
    vorhanden
      ? s.aendern("verfahrensdokuAngaben", { betriebId: kontext.betriebId }, werte)
      : s.einfuegen("verfahrensdokuAngaben", { betriebId: kontext.betriebId, ...werte }),
  );
  return ausZeile(zeile);
};

/** Each saved version of the statements: its link in the chain and when, oldest first */
export const angabenAenderungen = (
  db: Db,
  betriebId: string,
): { seq: number; zeitpunkt: number }[] =>
  db
    .select({ seq: auditGlieder.seq, zeitpunkt: auditGlieder.zeitpunkt })
    .from(auditGlieder)
    .where(
      and(
        eq(auditGlieder.betriebId, betriebId),
        eq(auditGlieder.tabelle, "verfahrensdokuAngaben"),
        eq(auditGlieder.zeile, zeilenId("verfahrensdokuAngaben", { betriebId })),
      ),
    )
    .orderBy(asc(auditGlieder.seq))
    .all();

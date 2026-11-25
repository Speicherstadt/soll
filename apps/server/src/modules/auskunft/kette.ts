import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { auditGlieder } from "../../db/schema.ts";
import { formatPruefwert, type TabellenName, zeilenId } from "../audit/index.ts";

/*
 * The links of the audit chain about the person: those that wrote one of the person's rows, with
 * who and when (the rows' content is in the other parts), and the links the person wrote, with table,
 * action and time only: their rows may be other people's data (Art. 15 Abs. 4 DSGVO).
 */

type Glied = typeof auditGlieder.$inferSelect;

/** The ids of the person's rows per table, in the form the chain names a row */
export type EigeneZeilen = Partial<Record<TabellenName, Record<string, unknown>[]>>;

const gliederZu = (db: Db, betriebId: string, zeilen: EigeneZeilen): Glied[] =>
  Object.entries(zeilen).flatMap(([tabelle, schluessel]) => {
    const ids = (schluessel ?? []).map((z) => zeilenId(tabelle as TabellenName, z));
    if (ids.length === 0) return [];
    return db
      .select()
      .from(auditGlieder)
      .where(
        and(
          eq(auditGlieder.betriebId, betriebId),
          eq(auditGlieder.tabelle, tabelle),
          inArray(auditGlieder.zeile, ids),
        ),
      )
      .all();
  });

const gliederVon = (db: Db, betriebId: string, nutzerId: string): Glied[] =>
  db
    .select()
    .from(auditGlieder)
    .where(and(eq(auditGlieder.betriebId, betriebId), eq(auditGlieder.akteur, nutzerId)))
    .all();

/** The Prüfwert of each closing of a month: the link that inserted its row */
export const pruefwerteJeAbschluss = (glieder: readonly Glied[]): Map<string, string> =>
  new Map(
    glieder
      .filter((g) => g.tabelle === "monatsabschluesse" && g.aktion === "einfuegen")
      .map((g) => [JSON.parse(g.zeile)[0] as string, formatPruefwert(g)]),
  );

/**
 * Tables whose rows the person shares with another person: a swap (S-504) has whoever offered, whoever
 * took it and whoever decided. Their links name only the person; who else wrote one is withheld
 * (Art. 15 Abs. 4 DSGVO).
 */
const GETEILT: ReadonlySet<string> = new Set<TabellenName>(["schichttausche"]);

export const ANDERE_PERSON = "eine andere Person";

export const kettenteil = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  zeilen: EigeneZeilen,
  name: (nutzerId: string) => string,
  iso: (zeitpunkt: number) => string,
) => {
  const zu = gliederZu(db, betriebId, zeilen).sort((a, b) => a.seq - b.seq);
  return {
    glieder: zu,
    teil: {
      zuDeinenDaten: zu.map((g) => ({
        nr: g.seq,
        zeitpunkt: iso(g.zeitpunkt),
        von: GETEILT.has(g.tabelle) && g.akteur !== nutzerId ? ANDERE_PERSON : name(g.akteur),
        tabelle: g.tabelle,
        zeile: JSON.parse(g.zeile) as unknown,
        aktion: g.aktion,
        inhaltHash: g.inhaltHash,
        hash: g.hash,
      })),
      vonDir: gliederVon(db, betriebId, nutzerId)
        .sort((a, b) => a.seq - b.seq)
        .map((g) => ({
          nr: g.seq,
          zeitpunkt: iso(g.zeitpunkt),
          tabelle: g.tabelle,
          aktion: g.aktion,
        })),
    },
  };
};

/** Whether a person was ever a member of the business: a link wrote their membership */
export const warMitglied = (db: Db, betriebId: string, nutzerId: string): boolean =>
  db
    .select({ seq: auditGlieder.seq })
    .from(auditGlieder)
    .where(
      and(
        eq(auditGlieder.betriebId, betriebId),
        eq(auditGlieder.tabelle, "mitgliedschaften"),
        eq(auditGlieder.zeile, zeilenId("mitgliedschaften", { nutzerId })),
      ),
    )
    .get() !== undefined;

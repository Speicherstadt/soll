import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import {
  arbeitszeitmodelle,
  aussonderungen,
  geraete,
  korrekturen,
  modellzuordnungen,
  monatsabschluesse,
  schichten,
  stempelungen,
} from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The person's records of working time and plan: every version of every stamp (nothing is ever
 * overwritten, S-304), counter-entries, the steps of closing a month with the content closed, the
 * models assigned, shifts and devices. `name` gives the name of who made an entry.
 */

type Name = (nutzerId: string) => string;

const stempelVon = (db: Db, betriebId: string, nutzerId: string, name: Name) =>
  db
    .select()
    .from(stempelungen)
    .where(and(eq(stempelungen.betriebId, betriebId), eq(stempelungen.nutzerId, nutzerId)))
    .orderBy(stempelungen.erstelltAm)
    .all()
    .map((z) => ({
      stempelId: z.stempelId,
      art: z.art,
      zeitpunkt: iso(z.zeitpunkt),
      geraetZeitpunkt: z.geraetZeitpunkt === null ? null : iso(z.geraetZeitpunkt),
      quelle: z.quelle,
      ersetzt: z.ersetzt,
      entfernt: z.entfernt,
      grund: z.grund,
      erfasstVon: name(z.erstelltVon),
      erfasstAm: iso(z.erstelltAm),
      geraetId: z.geraetId,
      nummer: z.nummer,
      signiert: z.signatur !== null,
      offline: z.offline,
      // taken over from another tool (S-701): the import, the tool and the id there
      ...(z.externQuelle === null
        ? {}
        : { uebernommen: { importId: z.importId, quelle: z.externQuelle, kennung: z.externId } }),
    }));

const gegeneintraegeVon = (db: Db, betriebId: string, nutzerId: string, name: Name) =>
  db
    .select()
    .from(korrekturen)
    .where(and(eq(korrekturen.betriebId, betriebId), eq(korrekturen.nutzerId, nutzerId)))
    .orderBy(korrekturen.erstelltAm)
    .all()
    .map((z) => ({
      korrekturId: z.korrekturId,
      tag: z.tag,
      minuten: z.minuten,
      grund: z.grund,
      gebuchtIn: z.gebuchtIn,
      von: name(z.erstelltVon),
      am: iso(z.erstelltAm),
    }));

const abschluesseVon = (db: Db, betriebId: string, nutzerId: string, name: Name) =>
  db
    .select()
    .from(monatsabschluesse)
    .where(
      and(eq(monatsabschluesse.betriebId, betriebId), eq(monatsabschluesse.nutzerId, nutzerId)),
    )
    .orderBy(monatsabschluesse.erstelltAm)
    .all()
    .map((z) => ({
      abschlussId: z.abschlussId,
      monat: z.monat,
      schritt: z.schritt,
      inhalt: JSON.parse(z.inhalt) as unknown,
      inhaltHash: z.inhaltHash,
      grund: z.grund,
      von: name(z.erstelltVon),
      am: iso(z.erstelltAm),
    }));

/** The models assigned to the person, with Soll and wage: they are the person's terms (§ 2 NachwG) */
const modelleVon = (db: Db, betriebId: string, nutzerId: string) => {
  const zuordnungen = db
    .select()
    .from(modellzuordnungen)
    .where(
      and(eq(modellzuordnungen.betriebId, betriebId), eq(modellzuordnungen.nutzerId, nutzerId)),
    )
    .orderBy(modellzuordnungen.gueltigAb)
    .all();
  const ids = [...new Set(zuordnungen.map((z) => z.modellId))];
  const modelle = new Map(
    (ids.length === 0
      ? []
      : db
          .select()
          .from(arbeitszeitmodelle)
          .where(
            and(
              eq(arbeitszeitmodelle.betriebId, betriebId),
              inArray(arbeitszeitmodelle.modellId, ids),
            ),
          )
          .all()
    ).map((m) => [m.modellId, m]),
  );
  return zuordnungen.map((z) => {
    const m = modelle.get(z.modellId);
    return {
      gueltigAb: z.gueltigAb,
      zugeordnetAm: iso(z.angelegtAm),
      modell: m && {
        name: m.name,
        sollMinutenMontagBisSonntag: JSON.parse(m.sollMinuten) as number[],
        lohnArt: m.lohnArt,
        lohnCent: m.lohnCent,
        minijob: m.minijob,
        zuschlagssaetze: JSON.parse(m.zuschlagssaetze) as Record<string, number>,
      },
    };
  });
};

/** The person's shifts in the plan, drafts included: they are data about the person too */
const schichtenVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(schichten)
    .where(and(eq(schichten.betriebId, betriebId), eq(schichten.nutzerId, nutzerId)))
    .orderBy(schichten.beginn)
    .all()
    .map((z) => ({
      schichtId: z.schichtId,
      tag: z.tag,
      beginn: iso(z.beginn),
      ende: iso(z.ende),
      pauseMinuten: z.pauseMinuten,
      rolle: z.rolle,
      veroeffentlichtAm: z.veroeffentlichtAm === null ? null : iso(z.veroeffentlichtAm),
    }));

const geraeteVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(geraete)
    .where(and(eq(geraete.betriebId, betriebId), eq(geraete.nutzerId, nutzerId)))
    .all()
    .map((z) => ({
      geraetId: z.geraetId,
      oeffentlicherSchluessel: JSON.parse(z.schluessel) as unknown,
      angelegtAm: iso(z.angelegtAm),
    }));

/** The closed months whose content was removed after the retention period (S-901), no content */
const aussonderungenVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(aussonderungen)
    .where(and(eq(aussonderungen.betriebId, betriebId), eq(aussonderungen.nutzerId, nutzerId)))
    .orderBy(aussonderungen.monat)
    .all()
    .map((z) => ({
      aussonderungId: z.aussonderungId,
      monat: z.monat,
      jahre: z.jahre,
      abgeschlossenAm: iso(z.abgeschlossenAm),
      ausgesondertAm: iso(z.ausgesondertAm),
    }));

export const arbeitsteil = (db: Db, betriebId: string, nutzerId: string, name: Name) => ({
  stempelungen: stempelVon(db, betriebId, nutzerId, name),
  gegeneintraege: gegeneintraegeVon(db, betriebId, nutzerId, name),
  monatsabschluesse: abschluesseVon(db, betriebId, nutzerId, name),
  aussonderungen: aussonderungenVon(db, betriebId, nutzerId),
  arbeitszeitmodelle: modelleVon(db, betriebId, nutzerId),
  schichten: schichtenVon(db, betriebId, nutzerId),
  geraete: geraeteVon(db, betriebId, nutzerId),
});

export type Arbeitsteil = ReturnType<typeof arbeitsteil>;

import { type Tag, tagInBerlin } from "@soll/arbeitszeit";
import { darf } from "../../auth/rollen.ts";
import type { Db } from "../../db/oeffnen.ts";
import {
  AKTIV,
  abgeschlosseneMonate,
  abwesenheitenIn,
  abwesenheitGesperrt,
  neueGesperrt,
  stempelungenIn,
  uebernommeneKennungen,
} from "../arbeitszeit/index.ts";
import { modulAktiv } from "../betrieb/index.ts";
import { type MitgliedMitName, mitgliederMitNamen } from "../mitglieder/index.ts";
import {
  buchungUeberschneidet,
  kundenLesen,
  projekteLesen,
  uebernommeneBuchungen,
} from "../projektzeit/index.ts";
import type { NeueAbwesenheit, Stand } from "./plan-typen.ts";

/*
 * What the plan of a takeover reads of the business now (BAULISTE.md S-701): members, modules, the
 * ids rows of the tool carry already, and per person the stamps, absences and closed months, each
 * loaded once when the plan first asks.
 */

/** The members whose times Soll records: who stamps (not a device) */
export const erfassteMitglieder = (db: Db, betriebId: string): MitgliedMitName[] =>
  mitgliederMitNamen(db, betriebId).filter((mitglied) => darf(mitglied.rolle, "stempeln"));

/** Loads once per person */
const jePerson = <T>(laden: (nutzerId: string) => T) => {
  const geladen = new Map<string, T>();
  return (nutzerId: string): T => {
    if (!geladen.has(nutzerId)) geladen.set(nutzerId, laden(nutzerId));
    return geladen.get(nutzerId) as T;
  };
};

/** An absence there already; an open sickness reaches to today, as for a new entry (S-401) */
const vorhandeneAbwesenheiten = (db: Db, betriebId: string, nutzerId: string, heute: Tag) =>
  abwesenheitenIn(db, betriebId, {
    nutzerId,
    von: "0000-01-01",
    bis: "9999-12-31",
    status: AKTIV,
  }).map((a) => ({ art: a.art, von: a.von, bis: a.bis ?? (heute < a.von ? a.von : heute) }));

const alsGenehmigt = (neu: NeueAbwesenheit) => ({
  art: neu.art,
  von: neu.von,
  bis: neu.bis,
  ersterHalb: false,
  letzterHalb: false,
  status: "genehmigt" as const,
  bescheinigung: null,
  kind: null,
});

/** Customers and orders of the business, and those of the tool by their id there */
const projektzeitVon = (db: Db, betriebId: string, quelle: string) => {
  const kunden = kundenLesen(db, betriebId);
  const projekte = projekteLesen(db, betriebId);
  const vonQuelle = <T extends { externQuelle: string | null; externId: string | null }>(
    zeilen: readonly T[],
    id: (zeile: T) => string,
  ) =>
    new Map(
      zeilen.flatMap((z) =>
        z.externQuelle === quelle && z.externId !== null ? [[z.externId, id(z)] as const] : [],
      ),
    );
  return {
    kunden: new Set(kunden.map((k) => k.kundeId)),
    projekte: new Set(projekte.map((p) => p.projektId)),
    uebernommeneKunden: vonQuelle(kunden, (k) => k.kundeId),
    uebernommeneProjekte: new Set(vonQuelle(projekte, (p) => p.projektId).keys()),
  };
};

export const standLesen = (db: Db, betriebId: string, quelle: string, jetzt: number): Stand => {
  const heute = tagInBerlin(jetzt);
  const kennungen = uebernommeneKennungen(db, betriebId, quelle);
  const projektzeit = projektzeitVon(db, betriebId, quelle);
  return {
    jetzt,
    module: {
      arbeitszeit: modulAktiv(db, betriebId, "arbeitszeit"),
      projektzeit: modulAktiv(db, betriebId, "projektzeit"),
    },
    mitglieder: new Set(erfassteMitglieder(db, betriebId).map((m) => m.nutzerId)),
    vorhanden: {
      stempelungen: kennungen.stempelungen,
      abwesenheiten: kennungen.abwesenheiten,
      kunden: projektzeit.uebernommeneKunden,
      projekte: projektzeit.uebernommeneProjekte,
      buchungen: uebernommeneBuchungen(db, betriebId, quelle),
    },
    buchungUeberschneidet: (nutzerId, spanne) =>
      buchungUeberschneidet(db, betriebId, nutzerId, spanne),
    kunden: projektzeit.kunden,
    projekte: projektzeit.projekte,
    geschlossen: jePerson((nutzerId) => abgeschlosseneMonate(db, betriebId, nutzerId)),
    stempelVon: jePerson((nutzerId) =>
      stempelungenIn(db, betriebId, nutzerId, 0, Number.MAX_SAFE_INTEGER),
    ),
    stempelGesperrt: (nutzerId, neue) => neueGesperrt(db, betriebId, nutzerId, neue),
    abwesenheitenVon: jePerson((nutzerId) =>
      vorhandeneAbwesenheiten(db, betriebId, nutzerId, heute),
    ),
    abwesenheitGesperrt: (nutzerId, neu) =>
      abwesenheitGesperrt(db, betriebId, nutzerId, {
        vorher: null,
        nachher: alsGenehmigt(neu),
        heute,
      }),
    neueId: () => crypto.randomUUID(),
  };
};

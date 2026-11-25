import {
  type ArtZuordnung,
  artenAus,
  artVorschlag,
  type LeseFehler,
  personenAus,
  personVorschlag,
  type Quelle,
  type Spaltenwahl,
} from "@soll/import";
import type { Db } from "../../db/oeffnen.ts";
import { modulAktiv } from "../betrieb/index.ts";
import { kundenLesen, projekteLesen } from "../projektzeit/index.ts";
import { type Vorschaubefund, vorschauBefunde } from "./befunde.ts";
import { dateiLesen } from "./datei.ts";
import { sha256Von } from "./dateispeicher.ts";
import { ARTEN, type Art } from "./plan-typen.ts";
import { erfassteMitglieder } from "./stand.ts";
import { MAX_LISTE } from "./uebernahme.ts";

/*
 * The preview of an import (BAULISTE.md S-701): what the reader found in the file, the lines it could
 * not read, what the mapping needs (persons, kinds, customers, orders, columns) with Soll's proposal,
 * and the findings of the rules on the file's times. Nothing is written.
 */

export type Vorschau = {
  datei: { name: string; sha256: string; bytes: number };
  felder: readonly string[];
  kopf: string[];
  spalten: Record<string, string | null>;
  anzahl: Record<Art, number>;
  lesefehler: { anzahl: number; liste: LeseFehler[] };
  personen: { person: string; datensaetze: number; vorschlag: string | null }[];
  mitglieder: { nutzerId: string; name: string }[];
  arten: { art: string; datensaetze: number; vorschlag: ArtZuordnung }[];
  kunden: { externalId: string; name: string; nummer: string }[];
  projekte: { externalId: string; name: string; nummer: string; kunde: string }[];
  vorhandeneKunden: { kundeId: string; name: string }[];
  vorhandeneProjekte: { projektId: string; name: string; kundeId: string }[];
  module: { arbeitszeit: boolean; projektzeit: boolean };
  befunde: { anzahl: number; liste: Vorschaubefund[] };
};

export const vorschau = (
  db: Db,
  betriebId: string,
  eingabe: { quelle: Quelle; datei: { name: string; bytes: Uint8Array }; spalten: Spaltenwahl },
  jetzt: number,
): Vorschau => {
  const gelesen = dateiLesen(eingabe.quelle, eingabe.datei.bytes, eingabe.spalten);
  const { daten } = gelesen;
  const mitglieder = erfassteMitglieder(db, betriebId).map(({ nutzerId, name }) => ({
    nutzerId,
    name,
  }));
  const befunde = vorschauBefunde(daten.zeiten, jetzt);
  return {
    datei: {
      name: eingabe.datei.name,
      sha256: sha256Von(eingabe.datei.bytes),
      bytes: eingabe.datei.bytes.length,
    },
    felder: eingabe.quelle.felder,
    kopf: gelesen.kopf,
    spalten: gelesen.spalten,
    anzahl: Object.fromEntries(ARTEN.map((art) => [art, daten[art].length])) as Record<Art, number>,
    lesefehler: { anzahl: gelesen.fehler.length, liste: gelesen.fehler.slice(0, MAX_LISTE) },
    personen: personenAus(daten).map((p) => ({
      ...p,
      vorschlag: personVorschlag(p.person, mitglieder),
    })),
    mitglieder,
    arten: artenAus(daten).map((a) => ({ ...a, vorschlag: artVorschlag(a.art) })),
    kunden: daten.kunden.map(({ externalId, name, nummer }) => ({ externalId, name, nummer })),
    projekte: daten.projekte.map(({ externalId, name, nummer, kunde }) => ({
      externalId,
      name,
      nummer,
      kunde,
    })),
    vorhandeneKunden: kundenLesen(db, betriebId).map(({ kundeId, name }) => ({ kundeId, name })),
    vorhandeneProjekte: projekteLesen(db, betriebId).map(({ projektId, name, kundeId }) => ({
      projektId,
      name,
      kundeId,
    })),
    module: {
      arbeitszeit: modulAktiv(db, betriebId, "arbeitszeit"),
      projektzeit: modulAktiv(db, betriebId, "projektzeit"),
    },
    befunde: { anzahl: befunde.length, liste: befunde.slice(0, MAX_LISTE) },
  };
};

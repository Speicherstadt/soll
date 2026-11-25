import type { Monat } from "@soll/arbeitszeit";
import type { Gelesen, LeseFehler, Quelle, Spaltenwahl, Zuordnung } from "@soll/import";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import {
  abwesenheitenUebernehmen,
  monatUebernehmen,
  stempelUebernehmen,
} from "../arbeitszeit/index.ts";
import { kanonisch } from "../audit/hash.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import {
  buchungenUebernehmen,
  kundenUebernehmen,
  projekteUebernehmen,
} from "../projektzeit/index.ts";
import { dateiLesen } from "./datei.ts";
import type { Dateispeicher } from "./dateispeicher.ts";
import { planen } from "./plan.ts";
import type { Abgelehnt, Monatssperre, Plan, Zahlen } from "./plan-typen.ts";
import { standLesen } from "./stand.ts";

/*
 * The dry run and the takeover of an import (BAULISTE.md S-701). Both read the file with the tool's
 * reader and plan against the business as it stands; the dry run stops there, the takeover keeps
 * the file under its SHA-256 and writes the plan and the row of `importe` in one transaction. Then
 * it closes the months the old tool had closed, each as its own closing; a run cut off there is
 * completed by the next one, which finds everything else there already.
 */

export type Eingabe = {
  quelle: Quelle;
  datei: { name: string; bytes: Uint8Array };
  spalten: Spaltenwahl;
  zuordnung: Zuordnung;
  /** the last month the old tool had closed; null: none */
  abgeschlossenBis: Monat | null;
};

/** As many lines as an answer names one by one; the numbers count all */
export const MAX_LISTE = 500;

export type Probelauf = {
  zahlen: Zahlen;
  lesefehler: { anzahl: number; liste: LeseFehler[] };
  abgelehnt: { anzahl: number; liste: Abgelehnt[] };
  /** the months that would be closed as taken over */
  monate: Monatssperre[];
};

const planVon = (db: Db, betriebId: string, eingabe: Eingabe, jetzt: number) => {
  const gelesen: Gelesen = dateiLesen(eingabe.quelle, eingabe.datei.bytes, eingabe.spalten);
  const stand = standLesen(db, betriebId, eingabe.quelle.id, jetzt);
  return {
    gelesen,
    plan: planen(gelesen.daten, eingabe.zuordnung, eingabe.abgeschlossenBis, stand),
  };
};

const alsProbelauf = (gelesen: Gelesen, plan: Plan): Probelauf => ({
  zahlen: plan.zahlen,
  lesefehler: { anzahl: gelesen.fehler.length, liste: gelesen.fehler.slice(0, MAX_LISTE) },
  abgelehnt: { anzahl: plan.abgelehnt.length, liste: plan.abgelehnt.slice(0, MAX_LISTE) },
  monate: plan.monate,
});

/** What a takeover would do, without writing anything */
export const probelauf = (
  db: Db,
  betriebId: string,
  eingabe: Eingabe,
  jetzt: number,
): Probelauf => {
  const { gelesen, plan } = planVon(db, betriebId, eingabe, jetzt);
  return alsProbelauf(gelesen, plan);
};

export type UmzugDeps = { db: Db; schreibDb: SchreibDb; speicher: Dateispeicher };

export type Uebernahme = Probelauf & {
  importId: string;
  dateiSha256: string;
  /** the months closed as taken over, and those that could not be, with the reason */
  gesperrt: Monatssperre[];
  nichtGesperrt: (Monatssperre & { grund: string })[];
};

/** The plan and its row in `importe`, all or nothing */
const schreibenAlles = (
  deps: UmzugDeps,
  kontext: Kontext,
  eingabe: Eingabe,
  zeile: { importId: string; dateiSha256: string; plan: Plan },
) => {
  const herkunft = { importId: zeile.importId, quelle: eingabe.quelle.id };
  schreiben(deps.schreibDb, kontext, (s) => {
    s.einfuegen("importe", {
      betriebId: kontext.betriebId,
      importId: zeile.importId,
      quelle: eingabe.quelle.id,
      dateiSha256: zeile.dateiSha256,
      dateiName: eingabe.datei.name,
      dateiBytes: eingabe.datei.bytes.length,
      zuordnung: kanonisch({ spalten: eingabe.spalten, ...eingabe.zuordnung }),
      abgeschlossenBis: eingabe.abgeschlossenBis,
      zahlen: kanonisch(zeile.plan.zahlen),
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
    });
    kundenUebernehmen(s, kontext, herkunft, zeile.plan.kunden);
    projekteUebernehmen(s, kontext, herkunft, zeile.plan.projekte);
    stempelUebernehmen(s, kontext, herkunft, zeile.plan.stempelungen);
    abwesenheitenUebernehmen(s, kontext, herkunft, zeile.plan.abwesenheiten);
    buchungenUebernehmen(s, kontext, herkunft, zeile.plan.buchungen);
  });
};

/** Closes the months the old tool had closed, each on its own (`monatUebernehmen`) */
const monateSperren = (
  deps: UmzugDeps,
  kontext: Kontext,
  eingabe: Eingabe,
  importId: string,
  monate: readonly Monatssperre[],
) => {
  const grund = `übernommen aus ${eingabe.quelle.name} (Import ${importId.slice(0, 8)})`;
  const ergebnisse = monate.map((sperre) => ({
    sperre,
    ergebnis: monatUebernehmen(deps.db, deps.schreibDb, kontext, { ...sperre, grund, importId }),
  }));
  return {
    gesperrt: ergebnisse.filter((e) => e.ergebnis.ok).map((e) => e.sperre),
    nichtGesperrt: ergebnisse.flatMap((e) =>
      e.ergebnis.ok ? [] : [{ ...e.sperre, grund: e.ergebnis.grund }],
    ),
  };
};

/**
 * Takes an import over; `gleichzeitig` when another import of the same rows came first. The file is
 * kept first; planning and writing follow without an `await` between them, so no other request runs
 * in between: a second takeover plans against the rows of the first and refuses what overlaps
 * (docs/plan.md, "Zwei Übernahmen zugleich").
 */
export const uebernehmen = async (
  deps: UmzugDeps,
  kontext: Kontext,
  eingabe: Eingabe,
): Promise<{ ok: true; wert: Uebernahme } | { ok: false; grund: "gleichzeitig" }> => {
  const dateiSha256 = await deps.speicher.speichern(eingabe.datei.bytes);
  // from here on synchronous: nothing else is written between the plan and its transaction
  const { gelesen, plan } = planVon(deps.db, kontext.betriebId, eingabe, kontext.jetzt);
  const importId = crypto.randomUUID();
  try {
    schreibenAlles(deps, kontext, eingabe, { importId, dateiSha256, plan });
  } catch (fehler) {
    if (/UNIQUE constraint failed/.test(String(fehler)))
      return { ok: false, grund: "gleichzeitig" };
    throw fehler;
  }
  const sperren = monateSperren(deps, kontext, eingabe, importId, plan.monate);
  return {
    ok: true,
    wert: { ...alsProbelauf(gelesen, plan), importId, dateiSha256, ...sperren },
  };
};

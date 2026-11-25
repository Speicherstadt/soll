import { einmal, personen } from "../abzug-gemeinsam.ts";
import { type Gelesen, type ImportDaten, type LeseFehler, leer } from "../modell.ts";
import { abwesenheitenAus } from "./abwesenheiten.ts";
import type { Bestand } from "./bestand.ts";
import { zeitenAus } from "./zeiten.ts";

/* What a reader found in Clockodo's data as the common model of every import (BAULISTE.md S-703) */

const stammdaten = (
  bestand: Bestand,
  fehler: LeseFehler[],
): Omit<ImportDaten, "zeiten" | "abwesenheiten" | "buchungen"> => {
  const kunden = einmal(bestand.kunden, fehler);
  const kundenIds = new Set(kunden.map((k) => k.id));
  const projekte = einmal(bestand.projekte, fehler).filter((p) => {
    if (kundenIds.has(p.kunde)) return true;
    fehler.push({ zeile: p.zeile, grund: "kunde_unbekannt", feld: "customers_id", wert: p.kunde });
    return false;
  });
  return {
    kunden: kunden.map(({ id, zeile, name, nummer }) => ({ externalId: id, zeile, name, nummer })),
    projekte: projekte.map(({ id, zeile, name, nummer, kunde }) => ({
      externalId: id,
      zeile,
      kunde,
      name,
      nummer,
    })),
    taetigkeiten: einmal(bestand.leistungen, fehler).map(({ id, zeile, name }) => ({
      externalId: id,
      zeile,
      name,
    })),
  };
};

export const ausBestand = (bestand: Bestand, kopf: string[]): Gelesen => {
  const fehler = [...bestand.fehler];
  const person = personen(einmal(bestand.nutzer, fehler));
  const zeiten = zeitenAus(einmal(bestand.eintraege, fehler), person);
  const abwesenheiten = abwesenheitenAus(einmal(bestand.abwesenheiten, fehler), person);
  const daten: ImportDaten = {
    ...leer(),
    ...stammdaten(bestand, fehler),
    zeiten: zeiten.zeiten,
    abwesenheiten: abwesenheiten.abwesenheiten,
  };
  fehler.push(...zeiten.fehler, ...abwesenheiten.fehler);
  return { daten, fehler: fehler.sort((a, b) => a.zeile - b.zeile), kopf, spalten: {} };
};

import { type Gelesen, type ImportDaten, type LeseFehler, leer } from "../modell.ts";
import { abwesenheitenAus } from "./abwesenheiten.ts";
import type { Bestand, Nutzer } from "./bestand.ts";
import { zeitenAus } from "./zeiten.ts";

/* What a reader found in Clockodo's data as the common model of every import (BAULISTE.md S-703) */

/**
 * A user's name as the person of the mapping; two users of the same name keep their id, so the
 * owner can tell them apart. A user the data does not list is named by its id.
 */
const personen = (nutzer: readonly Nutzer[]) => {
  const zahl = new Map<string, number>();
  for (const n of nutzer) zahl.set(n.name, (zahl.get(n.name) ?? 0) + 1);
  const namen = new Map(
    nutzer.map((n) => [n.id, (zahl.get(n.name) ?? 0) > 1 ? `${n.name} (${n.id})` : n.name]),
  );
  return (id: string): string => namen.get(id) ?? `#${id}`;
};

/** The first record of each id; a later one of the same kind is refused with its line */
const einmal = <T extends { zeile: number; id: string }>(
  saetze: readonly T[],
  fehler: LeseFehler[],
): T[] => {
  const gesehen = new Set<string>();
  return saetze.filter((satz) => {
    if (!gesehen.has(satz.id)) return gesehen.add(satz.id);
    fehler.push({ zeile: satz.zeile, grund: "kennung_doppelt", feld: "id", wert: satz.id });
    return false;
  });
};

const stammdaten = (
  bestand: Bestand,
  fehler: LeseFehler[],
): Omit<ImportDaten, "zeiten" | "abwesenheiten"> => {
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

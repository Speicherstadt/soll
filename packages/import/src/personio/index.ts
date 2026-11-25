import { istTag, plusTage } from "@soll/arbeitszeit";
import { einmal, personen } from "../abzug-gemeinsam.ts";
import { type Gelesen, leer, MAX_DATENSAETZE } from "../modell.ts";
import { textAusBytes } from "../text.ts";
import { abwesenheitenAus } from "./abwesenheiten.ts";
import { abzugLesen } from "./abzug-lesen.ts";
import type { Bestand } from "./bestand.ts";
import { tagVon } from "./werte.ts";
import { zeitenAus } from "./zeiten.ts";

/*
 * Personio (BAULISTE.md S-704): the file a fetch from its API v2 became (abzug.ts), read into the
 * common model. Persons are the persons of the mapping, attendance periods the spans of work,
 * absence periods the absences, all with Personio's ids.
 */

export {
  PERSONIO_ARTEN,
  PERSONIO_FELDER,
  PERSONIO_FORMAT,
  type PersonioAbzug,
  type PersonioArt,
  personioAbzugText,
} from "./abzug.ts";

/** The period of the head: work that begins on another day was not asked for */
const zeitraumVon = (kopf: Record<string, unknown>): { von: string; bis: string } | null => {
  const { von, bis } = kopf;
  return typeof von === "string" && typeof bis === "string" && istTag(von) && istTag(bis)
    ? { von, bis }
    : null;
};

const datenAus = (bestand: Bestand, zeitraum: { von: string; bis: string } | null) => {
  const fehler = [...bestand.fehler];
  const person = personen(einmal(bestand.personen, fehler));
  const arten = einmal(bestand.arten, fehler);
  const perioden = einmal(bestand.anwesenheiten, fehler).filter((p) => {
    if (zeitraum === null) return true;
    const tag = tagVon(p.beginn);
    // work that begins in the period; its breaks may lie on the day after (a night shift), and a
    // break without work of the period takes nothing away
    return tag >= zeitraum.von && tag <= (p.arbeit ? zeitraum.bis : plusTage(zeitraum.bis, 1));
  });
  const zeiten = zeitenAus(perioden, person);
  const abwesenheiten = abwesenheitenAus(einmal(bestand.abwesenheiten, fehler), arten, person);
  return {
    daten: { ...leer(), zeiten: zeiten.zeiten, abwesenheiten: abwesenheiten.abwesenheiten },
    fehler: [...fehler, ...zeiten.fehler, ...abwesenheiten.fehler].sort(
      (a, b) => a.zeile - b.zeile,
    ),
  };
};

/** Reads the file of a fetch from Personio; anything else is refused at its first line */
export const personioLesen = (bytes: Uint8Array): Gelesen => {
  const gelesen = abzugLesen(textAusBytes(bytes), MAX_DATENSAETZE);
  if ("fehler" in gelesen)
    return { daten: leer(), fehler: [gelesen.fehler], kopf: [], spalten: {} };
  return { ...datenAus(gelesen.bestand, zeitraumVon(gelesen.kopf)), kopf: [], spalten: {} };
};

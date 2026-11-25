import { istTag } from "@soll/arbeitszeit";
import { einmal, objekt, personen } from "../abzug-gemeinsam.ts";
import { type Gelesen, type ImportDaten, leer, MAX_DATENSAETZE } from "../modell.ts";
import { textAusBytes } from "../text.ts";
import { berlinerUhr } from "../uhr.ts";
import { abzugLesen } from "./abzug-lesen.ts";
import type { Benannt, Bestand } from "./bestand.ts";
import { zeitenAus } from "./zeiten.ts";

/*
 * Kimai (BAULISTE.md S-705): the file a fetch from its REST API became (abzug.ts), read into the
 * common model. Customers, projects and activities keep Kimai's ids; times are the blocks of a
 * person's timesheets, bookings their pieces with project and activity.
 */

export {
  KIMAI_ARTEN,
  KIMAI_FELDER,
  KIMAI_FORMAT,
  type KimaiAbzug,
  type KimaiArt,
  kimaiAbzugText,
} from "./abzug.ts";

const alsKunde = ({ zeile, id, name, nummer }: Benannt) => ({
  externalId: id,
  zeile,
  name,
  nummer,
});

/** The period of the head: timesheets that begin on another Berlin day were fetched as margin */
const zeitraumVon = (text: string): { von: string; bis: string } | null => {
  const ende = text.indexOf("\n");
  const kopf = objekt(ende === -1 ? text : text.slice(0, ende));
  const von = kopf?.von;
  const bis = kopf?.bis;
  return typeof von === "string" && typeof bis === "string" && istTag(von) && istTag(bis)
    ? { von, bis }
    : null;
};

const datenAus = (bestand: Bestand, zeitraum: { von: string; bis: string } | null) => {
  const fehler = [...bestand.fehler];
  const kunden = einmal(bestand.kunden, fehler);
  const kundenIds = new Set(kunden.map((k) => k.id));
  const projekte = einmal(bestand.projekte, fehler).filter((p) => {
    if (kundenIds.has(p.kunde)) return true;
    fehler.push({ zeile: p.zeile, grund: "kunde_unbekannt", feld: "customer", wert: p.kunde });
    return false;
  });
  const taetigkeiten = einmal(bestand.taetigkeiten, fehler);
  const person = personen(einmal(bestand.nutzer, fehler));
  const uhr = berlinerUhr();
  const zeitbuchungen = einmal(bestand.zeitbuchungen, fehler).filter((z) => {
    const tag = uhr.uhr(Math.floor(z.beginn / 60_000) * 60_000).tag;
    return zeitraum === null || (tag >= zeitraum.von && tag <= zeitraum.bis);
  });
  const zeiten = zeitenAus(zeitbuchungen, person, {
    projekte: new Set(projekte.map((p) => p.id)),
    taetigkeiten: new Set(taetigkeiten.map((t) => t.id)),
  });
  const daten: ImportDaten = {
    ...leer(),
    kunden: kunden.map(alsKunde),
    projekte: projekte.map((p) => ({ ...alsKunde(p), kunde: p.kunde })),
    taetigkeiten: taetigkeiten.map(({ zeile, id, name }) => ({ externalId: id, zeile, name })),
    zeiten: zeiten.zeiten,
    buchungen: zeiten.buchungen,
  };
  return { daten, fehler: [...fehler, ...zeiten.fehler].sort((a, b) => a.zeile - b.zeile) };
};

/** Reads the file of a fetch from Kimai; anything else is refused at its first line */
export const kimaiLesen = (bytes: Uint8Array): Gelesen => {
  const text = textAusBytes(bytes);
  const gelesen = abzugLesen(text, MAX_DATENSAETZE);
  if ("fehler" in gelesen)
    return { daten: leer(), fehler: [gelesen.fehler], kopf: [], spalten: {} };
  return { ...datenAus(gelesen.bestand, zeitraumVon(text)), kopf: [], spalten: {} };
};

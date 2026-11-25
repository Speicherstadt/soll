import { ABWESENHEITSARTEN, type Abwesenheitsart } from "@soll/arbeitszeit";
import type { ArtZuordnung, ImportDaten } from "./modell.ts";
import { schluessel } from "./text.ts";

/*
 * The mapping of an import (BAULISTE.md S-701): which member each person of the file is, which kind
 * of Soll each absence kind is, and whether a customer or an order is created, matched with one
 * that exists or left out; so is an activity (S-703). Soll proposes it; the owner decides, the server checks it again.
 */

/** A customer or an order: created anew, matched with an existing one by its id, or left out */
export type Ziel = "neu" | "aus" | { id: string };

export type Personenzuordnung = Record<string, string | null>;

export type Zuordnung = {
  /** the person of the file to a member (nutzerId); null or missing: not taken over */
  personen: Personenzuordnung;
  /** the kind of the file to a kind of Soll; null or missing: not taken over */
  arten: Record<string, ArtZuordnung>;
  /** by the id in the old tool; missing: created anew */
  kunden: Record<string, Ziel>;
  projekte: Record<string, Ziel>;
  /** activities (services in Clockodo, S-703), like customers */
  taetigkeiten: Record<string, Ziel>;
  /**
   * The project and activity of a time as the file names them, to an order and an activity of Soll
   * (S-702); null or missing: no booking. The activity "" is the one for times without one.
   */
  buchung?: Buchungszuordnung | undefined;
};

export type Buchungszuordnung = {
  projekte: Record<string, string | null>;
  taetigkeiten: Record<string, string | null>;
};

export type Mitglied = { nutzerId: string; name: string };

/** "Weber, Jonas" read as "Jonas Weber", as many exports write names */
const umgedreht = (name: string): string => {
  const teile = name.split(",").map((teil) => teil.trim());
  return teile.length === 2 ? `${teile[1]} ${teile[0]}` : name;
};

/** The one member whose name matches, or null: with none or two, the owner chooses */
export const personVorschlag = (person: string, mitglieder: readonly Mitglied[]): string | null => {
  const gesucht = new Set([schluessel(person), schluessel(umgedreht(person))]);
  const treffer = mitglieder.filter((mitglied) => gesucht.has(schluessel(mitglied.name)));
  return treffer.length === 1 ? (treffer[0] as Mitglied).nutzerId : null;
};

/** Words for the kinds of absence in German and English exports, compared by `schluessel` */
const ARTWOERTER: Record<string, Abwesenheitsart> = {
  ...Object.fromEntries(ABWESENHEITSARTEN.map((art) => [schluessel(art), art])),
  urlaub: "urlaub",
  erholungsurlaub: "urlaub",
  vacation: "urlaub",
  holiday: "urlaub",
  krank: "krank",
  krankheit: "krank",
  krankmeldung: "krank",
  arbeitsunfaehigkeit: "krank",
  sick: "krank",
  sickleave: "krank",
  sickness: "krank",
  kindkrank: "kind_krank",
  kinderkrank: "kind_krank",
  krankheitkind: "kind_krank",
  childsick: "kind_krank",
  sonderurlaub: "sonderurlaub",
  specialleave: "sonderurlaub",
  ueberstundenabbau: "ueberstundenabbau",
  uberstundenabbau: "ueberstundenabbau",
  freizeitausgleich: "ueberstundenabbau",
  timeoffinlieu: "ueberstundenabbau",
  // Clockodo's absence types as the SDK names them (clockodo/bestand.ts, S-703)
  regularholiday: "urlaub",
  sickday: "krank",
  sickdayofchild: "kind_krank",
  reductionofovertime: "ueberstundenabbau",
};

export const artVorschlag = (art: string): ArtZuordnung => ARTWOERTER[schluessel(art)] ?? null;

/** Each value once, sorted, with how many records carry it */
const gezaehlt = <K extends string>(werte: readonly string[], name: K) =>
  [
    ...werte.reduce(
      (zahl, wert) => zahl.set(wert, (zahl.get(wert) ?? 0) + 1),
      new Map<string, number>(),
    ),
  ]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([wert, datensaetze]) =>
        ({ [name]: wert, datensaetze }) as Record<K, string> & {
          datensaetze: number;
        },
    );

/** The persons a file names, with the number of their times, absences and bookings (S-705) */
export const personenAus = (daten: ImportDaten) =>
  gezaehlt(
    [...daten.zeiten, ...daten.abwesenheiten, ...daten.buchungen, ...daten.salden].map(
      (satz) => satz.person,
    ),
    "person",
  );

/** The kinds of absence a file names */
export const artenAus = (daten: ImportDaten) =>
  gezaehlt(
    daten.abwesenheiten.map((satz) => satz.art),
    "art",
  );

/** The projects the times of a file name, with how many times name each */
export const zeitProjekteAus = (daten: ImportDaten) =>
  gezaehlt(
    daten.zeiten.flatMap((zeit) => (zeit.projekt === undefined ? [] : [zeit.projekt])),
    "wert",
  );

/**
 * The activities the times of a file name; "" counts the times with a project but no activity,
 * which take the activity the owner chooses for them
 */
export const zeitTaetigkeitenAus = (daten: ImportDaten) =>
  gezaehlt(
    daten.zeiten.flatMap((zeit) =>
      zeit.taetigkeit !== undefined ? [zeit.taetigkeit] : zeit.projekt !== undefined ? [""] : [],
    ),
    "wert",
  );

/** Something of Soll a value may name: its id and the words it is known by (name, number) */
export type Kandidat = { id: string; woerter: readonly string[] };

/** The one candidate one of whose words matches the value, or null: with none or two, the owner chooses */
export const kandidatVorschlag = (wert: string, kandidaten: readonly Kandidat[]): string | null => {
  const gesucht = schluessel(wert);
  if (gesucht === "") return null;
  const treffer = kandidaten.filter((k) => k.woerter.some((wort) => schluessel(wort) === gesucht));
  return treffer.length === 1 ? (treffer[0] as Kandidat).id : null;
};

/** What Soll proposes: members by name, kinds by word, every customer and order created anew */
export const vorschlag = (daten: ImportDaten, mitglieder: readonly Mitglied[]): Zuordnung => ({
  personen: Object.fromEntries(
    personenAus(daten).map(({ person }) => [person, personVorschlag(person, mitglieder)]),
  ),
  arten: Object.fromEntries(artenAus(daten).map(({ art }) => [art, artVorschlag(art)])),
  kunden: {},
  projekte: {},
  taetigkeiten: {},
});

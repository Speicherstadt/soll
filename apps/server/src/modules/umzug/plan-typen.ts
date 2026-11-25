import type { Abwesenheitsart, Monat, Stempelart, Stempelung, Tag } from "@soll/arbeitszeit";
import type { ImportDaten } from "@soll/import";

/*
 * The plan of a takeover (BAULISTE.md S-701): what an import would write, what is there already,
 * what the owner left out and what is refused with its line and reason. The dry run shows it, the
 * takeover writes exactly it. Computed by pure functions from the file, the mapping and `Stand`.
 */

export type Art = keyof ImportDaten;
export const ARTEN: readonly Art[] = [
  "zeiten",
  "abwesenheiten",
  "kunden",
  "projekte",
  "taetigkeiten",
];

/** What a plan counts: the records of the file, and the bookings made from times (S-702) */
export type PlanArt = Art | "buchungen";

export const PLAN_GRUENDE = [
  "person_unbekannt",
  "modul_aus",
  "zeit_gibt_es_nicht",
  "pause_ungueltig",
  "zukunft",
  "ueberschneidung",
  "monat_abgeschlossen",
  "kunde_unbekannt",
  "projekt_unbekannt",
  "kunde_ausgelassen",
  "taetigkeit_unbekannt",
  "zuordnung_abweichend",
  "geaendert_im_alten_tool",
] as const;
export type PlanGrund = (typeof PLAN_GRUENDE)[number];

export type Abgelehnt = { art: PlanArt; zeile: number; externalId: string; grund: PlanGrund };

/** Per kind: created, there already, left out by the owner, refused */
export type Anzahl = { neu: number; vorhanden: number; ausgelassen: number; abgelehnt: number };
export type Zahlen = Record<PlanArt, Anzahl>;

export type NeueStempelung = Stempelung & { nutzerId: string; externId: string };
export type NeueAbwesenheit = {
  nutzerId: string;
  art: Abwesenheitsart;
  von: Tag;
  bis: Tag;
  externId: string;
};
export type NeuerKunde = { kundeId: string; name: string; nummer: string; externId: string };
export type NeuesProjekt = {
  projektId: string;
  kundeId: string;
  name: string;
  nummer: string;
  externId: string;
};

export type NeueTaetigkeit = { taetigkeitId: string; name: string; externId: string };
/** A booking of project time made from a time with a project or an activity (S-702) */
export type NeueBuchung = {
  nutzerId: string;
  projektId: string | null;
  taetigkeitId: string;
  beginn: number;
  ende: number;
  tag: Tag;
  externId: string;
};

/** A month of a person the old tool had closed, to be closed as taken over */
export type Monatssperre = { nutzerId: string; monat: Monat };

export type Plan = {
  stempelungen: NeueStempelung[];
  abwesenheiten: NeueAbwesenheit[];
  kunden: NeuerKunde[];
  projekte: NeuesProjekt[];
  taetigkeiten: NeueTaetigkeit[];
  buchungen: NeueBuchung[];
  monate: Monatssperre[];
  zahlen: Zahlen;
  abgelehnt: Abgelehnt[];
};

/** A stamp an earlier import wrote: whose it is and when, by its id in the old tool */
export type GespeicherterStempel = { nutzerId: string; zeitpunkt: number };
/** An absence an earlier import wrote, by its id in the old tool */
export type GespeicherteAbwesenheit = {
  nutzerId: string;
  art: Abwesenheitsart;
  von: Tag;
  bis: Tag | null;
};

/** An absence there already, as far as an overlap needs it */
export type VorhandeneAbwesenheit = { art: Abwesenheitsart; von: Tag; bis: Tag | null };

/** What the plan reads of the business now; functions load per person when asked */
export type Stand = {
  jetzt: number;
  module: { arbeitszeit: boolean; projektzeit: boolean };
  /** members of the business who may have times and absences */
  mitglieder: ReadonlySet<string>;
  /** the ids in the old tool that rows of this tool already carry, stamps and absences with the
   * person whose row it is */
  vorhanden: {
    stempelungen: ReadonlyMap<string, GespeicherterStempel>;
    abwesenheiten: ReadonlyMap<string, GespeicherteAbwesenheit>;
    /** the customer created from an id, for its orders */
    kunden: ReadonlyMap<string, string>;
    projekte: ReadonlySet<string>;
    /** the activity created from an id (S-703) */
    taetigkeiten: ReadonlyMap<string, string>;
    /** the bookings made from times of this tool, by their id (S-702) */
    buchungen: ReadonlySet<string>;
  };
  /** whether a span would overlap a booking of the person there already (S-702) */
  buchungUeberschneidet: (nutzerId: string, spanne: { beginn: number; ende: number }) => boolean;
  /** the customers and orders of the business, for a mapping to an existing one */
  kunden: ReadonlySet<string>;
  projekte: ReadonlySet<string>;
  taetigkeiten: ReadonlySet<string>;
  /** the months closed for a person */
  geschlossen: (nutzerId: string) => ReadonlySet<Monat>;
  /** a person's stamps in force, in time order */
  stempelVon: (nutzerId: string) => readonly Stempelung[];
  /** whether new stamps would change the records of a closed month (S-306) */
  stempelGesperrt: (nutzerId: string, neue: readonly Stempelung[]) => boolean;
  /** a person's absences requested or approved */
  abwesenheitenVon: (nutzerId: string) => readonly VorhandeneAbwesenheit[];
  /** whether an approved absence would change a day of a closed month */
  abwesenheitGesperrt: (nutzerId: string, neu: NeueAbwesenheit) => boolean;
  neueId: () => string;
};

export const keineZahlen = (): Zahlen => ({
  zeiten: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
  abwesenheiten: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
  kunden: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
  projekte: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
  taetigkeiten: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
  buchungen: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
});

export const STEMPELARTEN: readonly Stempelart[] = [
  "kommen",
  "pause_beginn",
  "pause_ende",
  "gehen",
];

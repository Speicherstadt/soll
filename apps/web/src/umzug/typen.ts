import type { Abwesenheitsart } from "@soll/arbeitszeit";
import type { LeseFehler, Ziel } from "@soll/import";

/* What the API of imports answers (apps/server, routes/importe.ts; S-701) */

export type Art =
  | "zeiten"
  | "abwesenheiten"
  | "kunden"
  | "projekte"
  | "taetigkeiten"
  | "buchungen"
  | "schichten";
export const ARTEN: readonly Art[] = [
  "zeiten",
  "abwesenheiten",
  "kunden",
  "projekte",
  "taetigkeiten",
  "buchungen",
  "schichten",
];

/**
 * What a dry run and a takeover count: the records; bookings are those a tool kept (S-705) and
 * those made from times (S-702)
 */
export type PlanArt = Art;
export const PLAN_ARTEN: readonly PlanArt[] = ARTEN;

/** A value of the file's column Projekt or Tätigkeit, with how many times name it (S-702) */
export type Wertvorschlag = { wert: string; datensaetze: number; vorschlag: string | null };

export type Liste<T> = { anzahl: number; liste: T[] };

export type Vorschaubefund = {
  person: string;
  regel: string;
  norm: string;
  schwere: "hinweis" | "verstoss";
  tage: string[];
};

export type Vorschau = {
  datei: { name: string; sha256: string; bytes: number };
  felder: string[];
  kopf: string[];
  spalten: Record<string, string | null>;
  anzahl: Record<Art, number>;
  lesefehler: Liste<LeseFehler>;
  personen: { person: string; datensaetze: number; vorschlag: string | null }[];
  mitglieder: { nutzerId: string; name: string }[];
  arten: { art: string; datensaetze: number; vorschlag: Abwesenheitsart | null }[];
  kunden: { externalId: string; name: string; nummer: string }[];
  projekte: { externalId: string; name: string; nummer: string; kunde: string }[];
  vorhandeneKunden: { kundeId: string; name: string }[];
  vorhandeneProjekte: { projektId: string; name: string; kundeId: string }[];
  taetigkeiten: { externalId: string; name: string }[];
  vorhandeneTaetigkeiten: { taetigkeitId: string; name: string }[];
  module: { arbeitszeit: boolean; projektzeit: boolean; dienstplan: boolean };
  /** the sites the shifts of a shift planner may go to (S-706) */
  standorte: { standortId: string; name: string }[];
  befunde: Liste<Vorschaubefund>;
  buchung: {
    projekte: Wertvorschlag[];
    taetigkeiten: Wertvorschlag[];
    buchbareProjekte: { projektId: string; name: string; nummer: string; kunde: string }[];
    buchbareTaetigkeiten: { taetigkeitId: string; name: string; fest: boolean }[];
  };
};

export type Anzahl = { neu: number; vorhanden: number; ausgelassen: number; abgelehnt: number };
export type Abgelehnt = { art: PlanArt; zeile: number; externalId: string; grund: string };
export type Monatssperre = { nutzerId: string; monat: string };

export type Probelauf = {
  zahlen: Record<PlanArt, Anzahl>;
  lesefehler: Liste<LeseFehler>;
  abgelehnt: Liste<Abgelehnt>;
  monate: Monatssperre[];
};

export type Uebernahme = Probelauf & {
  importId: string;
  dateiSha256: string;
  gesperrt: Monatssperre[];
  nichtGesperrt: (Monatssperre & { grund: string })[];
};

export type ImportEintrag = {
  importId: string;
  quelle: string;
  quelleName: string;
  dateiName: string;
  dateiSha256: string;
  dateiBytes: number;
  abgeschlossenBis: string | null;
  /** an import before S-702 or S-705 counts fewer kinds */
  zahlen: Partial<Record<PlanArt, Anzahl>>;
  von: string;
  am: number;
};

/** A fetch over a tool's API (S-705): the instance, its token, the period */
/** The file as the API takes it: its name and its bytes in base64 */
export type Datei = { name: string; inhalt: string };

/** What POST /importe/abruf takes (S-703): the access for this one fetch and the period */
/** A fetch over a tool's API: Clockodo's access (S-703) or a Kimai instance with its token (S-705) */
export type Abruf = {
  zugang:
    | { nutzer: string; schluessel: string }
    | { instanz: string; token: string; benutzer: string | null }
    // the shift planners (S-706): Papershift's token, Planday's app, a Crewmeister account
    | { token: string }
    | { appId: string; token: string }
    | { email: string; passwort: string };
  von: string;
  bis: string;
};

export type { Ziel };

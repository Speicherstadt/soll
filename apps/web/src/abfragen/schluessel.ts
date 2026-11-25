/**
 * The resources the client asks the API for, each with the key it is cached under and the path it is
 * loaded from (docs/entwicklung.md, "Daten laden"). A key starts with the resource's path, so a write
 * invalidates every variant of a resource (each month, each week) with `alle(PFAD.…)`.
 */
export type Schluessel = readonly unknown[];
export type Ressource = { schluessel: Schluessel; pfad: string };

const AZ = "/api/v1/arbeitszeit";
const ABW = `${AZ}/abwesenheiten`;
const PLAN = "/api/v1/dienstplan";
const PZ = "/api/v1/projektzeit";
const TERMINAL = "/api/v1/terminal";

export const PFAD = {
  personen: `${AZ}/personen`,
  modelle: `${AZ}/modelle`,
  tag: `${AZ}/tag`,
  monat: `${AZ}/monat`,
  erinnerungen: `${AZ}/erinnerungen`,
  datev: `${AZ}/datev`,
  abwesenheiten: ABW,
  abwesenheitenOffen: `${ABW}/offen`,
  abwesenheitenTeam: `${ABW}/team`,
  konten: `${AZ}/konten`,
  standorte: "/api/v1/standorte",
  pruefung: "/api/v1/betrieb/pruefung",
  // the key of every person's data for the rules; each is loaded from /personen/:nutzerId/angaben
  angaben: "/api/v1/personen/angaben",
  woche: `${PLAN}/woche`,
  vorlagen: `${PLAN}/vorlagen`,
  bedarf: `${PLAN}/bedarf`,
  kalender: `${PLAN}/kalender`,
  kunden: `${PZ}/kunden`,
  projekte: `${PZ}/projekte`,
  taetigkeiten: `${PZ}/taetigkeiten`,
  saetze: `${PZ}/saetze`,
  satzPersonen: `${PZ}/saetze/personen`,
  zugaenge: "/api/v1/zugaenge",
  terminalGeraete: `${TERMINAL}/geraete`,
  terminalPersonen: `${TERMINAL}/personen`,
  terminalKarten: `${TERMINAL}/karten`,
  stoppuhr: `${PZ}/stoppuhr`,
  // the kiosk's own state, asked with its device token instead of a session (terminal/ablauf.ts)
  kiosk: "/api/v1/kiosk",
  nachweise: `${PZ}/stundennachweise`,
  nachweisVorschau: `${PZ}/stundennachweise/vorschau`,
  auslastung: `${PZ}/auslastung`,
  auslastungPersonen: `${PZ}/auslastung/personen`,
  auslastungIch: `${PZ}/auslastung/ich`,
  habenZugang: `${PZ}/haben/zugang`,
  habenKontakte: `${PZ}/haben/kontakte`,
  habenBuchungen: `${PZ}/haben/buchungen`,
  habenUebergabe: `${PZ}/haben/uebergabe`,
  // imports from other tools, for the owner (S-701)
  importe: "/api/v1/importe",
} as const;

type Parameter = Record<string, string | undefined>;

/** A resource with query parameters; one left empty is neither asked nor part of the key */
const mitParametern = (pfad: string, parameter: Parameter): Ressource => {
  const gesetzt = Object.entries(parameter).filter(
    (eintrag): eintrag is [string, string] => eintrag[1] !== undefined && eintrag[1] !== "",
  );
  const frage = new URLSearchParams(gesetzt).toString();
  return {
    schluessel: [pfad, Object.fromEntries(gesetzt)],
    pfad: frage ? `${pfad}?${frage}` : pfad,
  };
};

const einfach = (pfad: string): Ressource => ({ schluessel: [pfad], pfad });

export const ressourcen = {
  personen: () => einfach(PFAD.personen),
  modelle: () => einfach(PFAD.modelle),
  tag: (parameter: { datum?: string | undefined; nutzerId?: string | undefined }) =>
    mitParametern(PFAD.tag, parameter),
  monat: (parameter: { monat: string; nutzerId?: string | undefined }) =>
    mitParametern(PFAD.monat, parameter),
  erinnerungen: () => einfach(PFAD.erinnerungen),
  datev: () => einfach(PFAD.datev),
  abwesenheiten: () => einfach(PFAD.abwesenheiten),
  abwesenheitenOffen: () => einfach(PFAD.abwesenheitenOffen),
  abwesenheitenTeam: (parameter: { von: string; bis: string; standortId?: string | undefined }) =>
    mitParametern(PFAD.abwesenheitenTeam, parameter),
  konten: (parameter: { nutzerId?: string | undefined }) => mitParametern(PFAD.konten, parameter),
  standorte: () => einfach(PFAD.standorte),
  pruefung: () => einfach(PFAD.pruefung),
  angaben: (nutzerId: string): Ressource => ({
    schluessel: [PFAD.angaben, { nutzerId }],
    pfad: `/api/v1/personen/${encodeURIComponent(nutzerId)}/angaben`,
  }),
  woche: (parameter: { standortId: string; tag: string }) => mitParametern(PFAD.woche, parameter),
  vorlagen: () => einfach(PFAD.vorlagen),
  bedarf: (standortId: string) => mitParametern(PFAD.bedarf, { standortId }),
  kalender: () => einfach(PFAD.kalender),
  kunden: () => einfach(PFAD.kunden),
  projekte: () => einfach(PFAD.projekte),
  taetigkeiten: () => einfach(PFAD.taetigkeiten),
  saetze: () => einfach(PFAD.saetze),
  satzPersonen: () => einfach(PFAD.satzPersonen),
  zugaenge: () => einfach(PFAD.zugaenge),
  terminalGeraete: () => einfach(PFAD.terminalGeraete),
  terminalPersonen: () => einfach(PFAD.terminalPersonen),
  terminalKarten: () => einfach(PFAD.terminalKarten),
  stoppuhr: (parameter: { tag?: string | undefined }) => mitParametern(PFAD.stoppuhr, parameter),
  nachweise: () => einfach(PFAD.nachweise),
  nachweisVorschau: (parameter: {
    projektId: string;
    von: string;
    bis: string;
    nutzerId?: string | undefined;
  }) => mitParametern(PFAD.nachweisVorschau, parameter),
  auslastung: (monat: string) => mitParametern(PFAD.auslastung, { monat }),
  auslastungPersonen: (monat: string) => mitParametern(PFAD.auslastungPersonen, { monat }),
  auslastungIch: (monat: string) => mitParametern(PFAD.auslastungIch, { monat }),
  habenZugang: () => einfach(PFAD.habenZugang),
  habenKontakte: () => einfach(PFAD.habenKontakte),
  habenBuchungen: (parameter: { projektId: string; von: string; bis: string }) =>
    mitParametern(PFAD.habenBuchungen, parameter),
  importe: () => einfach(PFAD.importe),
};

/** The key of every variant of a resource, for invalidating after a write */
export const alle = (pfad: string): Schluessel => [pfad];

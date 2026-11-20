/**
 * The resources the client asks the API for, each with the key it is cached under and the path it is
 * loaded from (docs/entwicklung.md, "Daten laden"). A key starts with the resource's path, so a write
 * invalidates every variant of a resource (each month, each week) with `alle(PFAD.…)`.
 */
export type Schluessel = readonly unknown[];
export type Ressource = { schluessel: Schluessel; pfad: string };

const AZ = "/api/v1/arbeitszeit";
const PLAN = "/api/v1/dienstplan";
const PZ = "/api/v1/projektzeit";

export const PFAD = {
  personen: `${AZ}/personen`,
  modelle: `${AZ}/modelle`,
  tag: `${AZ}/tag`,
  monat: `${AZ}/monat`,
  erinnerungen: `${AZ}/erinnerungen`,
  datev: `${AZ}/datev`,
  standorte: "/api/v1/standorte",
  woche: `${PLAN}/woche`,
  vorlagen: `${PLAN}/vorlagen`,
  bedarf: `${PLAN}/bedarf`,
  kunden: `${PZ}/kunden`,
  projekte: `${PZ}/projekte`,
  taetigkeiten: `${PZ}/taetigkeiten`,
  saetze: `${PZ}/saetze`,
  satzPersonen: `${PZ}/saetze/personen`,
  zugaenge: "/api/v1/zugaenge",
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
  standorte: () => einfach(PFAD.standorte),
  woche: (parameter: { standortId: string; tag: string }) => mitParametern(PFAD.woche, parameter),
  vorlagen: () => einfach(PFAD.vorlagen),
  bedarf: (standortId: string) => mitParametern(PFAD.bedarf, { standortId }),
  kunden: () => einfach(PFAD.kunden),
  projekte: () => einfach(PFAD.projekte),
  taetigkeiten: () => einfach(PFAD.taetigkeiten),
  saetze: () => einfach(PFAD.saetze),
  satzPersonen: () => einfach(PFAD.satzPersonen),
  zugaenge: () => einfach(PFAD.zugaenge),
};

/** The key of every variant of a resource, for invalidating after a write */
export const alle = (pfad: string): Schluessel => [pfad];

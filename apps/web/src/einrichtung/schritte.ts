import type { Module } from "@soll/arbeitszeit";

/** The steps of the setup in the order of the mockup (design/mockup/Einrichtung.dc.html) */
export const SCHRITTE = [
  "betrieb",
  "standorte",
  "arbeitszeit",
  "mitarbeiter",
  "einladungen",
] as const;
export type Schritt = (typeof SCHRITTE)[number];

/**
 * The steps a business goes through: without employees there are no sites to clock in at, no
 * working-time models and no one to invite, so a freelancer names the business and is done
 */
export const schritteFuer = (module: Module): Schritt[] =>
  module.arbeitszeit ? [...SCHRITTE] : ["betrieb"];

export type Hinweis =
  | "pflicht"
  | "solo"
  | "feiertage"
  | "terminal_standort"
  | "vorlagen"
  | "dienstplan_soll"
  | "csv_vorlage"
  | "links_einmal"
  | "terminal_pin"
  | "danach_stempeln"
  | "danach_dienstplan"
  | "danach_projekte"
  | "danach_terminal";

const HINWEISE: Record<Schritt, (module: Module) => (Hinweis | false)[]> = {
  betrieb: (m) => [m.arbeitszeit ? "pflicht" : "solo"],
  standorte: (m) => ["feiertage", m.terminal && "terminal_standort"],
  arbeitszeit: (m) => ["vorlagen", m.dienstplan && "dienstplan_soll"],
  mitarbeiter: () => ["csv_vorlage"],
  einladungen: (m) => ["links_einmal", m.terminal && "terminal_pin"],
};

/** What comes after the setup, one hint per module the business uses */
const danach = (m: Module): (Hinweis | false)[] => [
  m.arbeitszeit && "danach_stempeln",
  m.dienstplan && "danach_dienstplan",
  m.projektzeit && "danach_projekte",
  m.terminal && "danach_terminal",
];

/** The hints beside a step; the last step also says what comes next */
export const hinweiseFuer = (schritt: Schritt, module: Module): Hinweis[] => {
  const letzter = schritteFuer(module).at(-1) === schritt;
  return [...HINWEISE[schritt](module), ...(letzter ? danach(module) : [])].filter(
    (hinweis): hinweis is Hinweis => hinweis !== false,
  );
};

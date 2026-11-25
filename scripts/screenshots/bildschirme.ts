/**
 * The screens the documentation shows (BAULISTE.md S-908, docs/entwicklung.md "Screenshots"): who
 * is signed in, which path, on which devices, and what must be on the page before the picture is
 * taken. Pure data; scripts/screenshots/aufnahme.ts takes the pictures. Each screen comes in light
 * and dark, named `<name>-<light|dark>-<device>.png` under docs/assets/screenshots/.
 */
export const THEMEN = ["light", "dark"] as const;
export type Thema = (typeof THEMEN)[number];

/** Desktop and phone as in DESIGN.md; the terminal is the tablet in landscape (1280 × 800) */
export const GERAETE = {
  desktop: { breite: 1280, hoehe: 800, mobil: false },
  phone: { breite: 412, hoehe: 915, mobil: true },
  terminal: { breite: 1280, hoehe: 800, mobil: false },
} as const;
export type Geraet = keyof typeof GERAETE;

/** Pictures people look at, on sharp screens (docs/plan.md, "Screenshots") */
export const PIXELDICHTE = 2;

export const ZIEL = "docs/assets/screenshots";

/**
 * The day the pictures show unless `--heute` says otherwise: a Wednesday, so the café is open and
 * Weber's fitters are at work; a fixed day keeps the pictures the same from run to run
 */
export const STANDARD_HEUTE = "2026-11-25";

/**
 * Who uses the screen: a sign-in of the demo (docs/demo.md, "Anmeldung"), the café's paired
 * tablet, or nobody (the Prüfseite is open without signing in)
 */
export type Wer = { anmeldung: string } | "terminal" | "niemand";

/**
 * A step before the picture: wait for the text of a message key of messages/de.json, or type the
 * demo's Prüfwert into the Prüfseite and check it
 */
export type Schritt = { warten: string } | "pruefwert";

export type Bildschirm = {
  name: string;
  pfad: string;
  wer: Wer;
  geraete: readonly Geraet[];
  /** the message key of the page's heading: the text before its first placeholder must show */
  titel: string;
  schritte?: readonly Schritt[];
};

const JONAS = { anmeldung: "jonas@weber-haustechnik.test" };
const SANDRA = { anmeldung: "sandra" };
const LEA = { anmeldung: "lea" };
const ANNA = { anmeldung: "anna" };
const BEIDE: readonly Geraet[] = ["desktop", "phone"];

export const BILDSCHIRME: readonly Bildschirm[] = [
  { name: "heute", pfad: "/", wer: SANDRA, geraete: BEIDE, titel: "nav_heute" },
  { name: "zeiten", pfad: "/zeiten", wer: ANNA, geraete: BEIDE, titel: "nav_zeiten" },
  {
    name: "monat",
    pfad: "/monat",
    wer: SANDRA,
    geraete: BEIDE,
    titel: "monat_titel_person",
    // the month before, closed with its Prüfwert, is what the page opens on
    schritte: [{ warten: "monat_pruefwert" }],
  },
  {
    name: "abwesenheiten",
    pfad: "/abwesenheiten",
    wer: SANDRA,
    geraete: BEIDE,
    titel: "nav_abwesenheiten",
  },
  { name: "dienstplan", pfad: "/dienstplan", wer: LEA, geraete: BEIDE, titel: "nav_dienstplan" },
  { name: "projekte", pfad: "/projekte", wer: JONAS, geraete: BEIDE, titel: "nav_projekte" },
  {
    name: "einstellungen",
    pfad: "/einstellungen",
    wer: JONAS,
    geraete: BEIDE,
    titel: "nav_einstellungen",
  },
  {
    name: "pruefen",
    pfad: "/pruefen",
    wer: "niemand",
    geraete: BEIDE,
    titel: "pruefen_titel",
    schritte: ["pruefwert", { warten: "pruefen_ok" }],
  },
  {
    name: "terminal",
    pfad: "/terminal",
    wer: "terminal",
    geraete: ["terminal"],
    titel: "kiosk_titel",
  },
];

export const dateiName = (name: string, thema: Thema, geraet: Geraet): string =>
  `${name}-${thema}-${geraet}.png`;

export type Aufnahme = { bildschirm: Bildschirm; thema: Thema; geraet: Geraet; datei: string };

/** Every picture of the list, or of the screens named in `nur` */
export const aufnahmen = (liste: readonly Bildschirm[], nur: readonly string[] = []): Aufnahme[] =>
  liste
    .filter((b) => nur.length === 0 || nur.includes(b.name))
    .flatMap((bildschirm) =>
      bildschirm.geraete.flatMap((geraet) =>
        THEMEN.map((thema) => ({
          bildschirm,
          thema,
          geraet,
          datei: dateiName(bildschirm.name, thema, geraet),
        })),
      ),
    );

/** The text before the first placeholder of a message: what a heading must start with */
export const festerTeil = (text: string): string => (text.split("{")[0] ?? "").trim();

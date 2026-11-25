import { plusTage, type Tag } from "@soll/arbeitszeit";

/**
 * The two businesses of the test data, exactly as CLAUDE.md ("Test data") names them: Weber
 * Haustechnik (SHK, Hamburg) and Café Elbblick (Hamburg). Addresses and e-mail under `.test`
 * (RFC 2606), so nothing can ever reach a real mailbox.
 */
export type Modell = {
  name: string;
  /** Monday to Sunday, whole minutes */
  sollMinuten: readonly number[];
  lohnArt: "monat" | "stunde";
  lohnCent: number;
  minijob: boolean;
};

export type Person = {
  schluessel: string;
  name: string;
  /** the owner signs up with e-mail; everyone else is invited by link and signs in with a username */
  rolle: "inhaber" | "planer" | "mitarbeiter";
  /** the working-time model; null for the owner, who does not stamp */
  modell: string | null;
  /** the PIN at the café's terminal */
  pin?: string;
};

export type Betrieb = {
  schluessel: "weber" | "cafe";
  name: string;
  slug: string;
  email: string;
  standort: { name: string; adresse: string };
  fragen: { beschaeftigte: boolean; schichten: boolean; kunden: boolean; stempelort: boolean };
  pruefung: { branche: "gastronomie_beherbergung" | null; sonntagsausnahme: number | null };
  modelle: Readonly<Record<string, Modell>>;
  personen: readonly Person[];
};

const monat = (name: string, sollMinuten: readonly number[], lohnCent: number): Modell => ({
  name,
  sollMinuten,
  lohnArt: "monat",
  lohnCent,
  minijob: false,
});

export const WEBER: Betrieb = {
  schluessel: "weber",
  name: "Weber Haustechnik",
  slug: "weber-haustechnik",
  email: "jonas@weber-haustechnik.test",
  standort: { name: "Werkstatt", adresse: "Hafenstraße 12, 20459 Hamburg" },
  // a plan of the coming week's jobs, project time for the customers, stamping on the phone
  fragen: { beschaeftigte: true, schichten: true, kunden: true, stempelort: false },
  pruefung: { branche: null, sonntagsausnahme: null },
  modelle: {
    vollzeit: monat("Vollzeit 39 h", [468, 468, 468, 468, 468, 0, 0], 340_000),
    buero: monat("Teilzeit Büro 30 h", [360, 360, 360, 360, 360, 0, 0], 210_000),
    // Friday is Berufsschule (§ 9 JArbSchG), not stamped in the business
    ausbildung: monat("Ausbildung", [450, 450, 450, 450, 0, 0, 0], 95_000),
  },
  personen: [
    { schluessel: "jonas", name: "Jonas Weber", rolle: "inhaber", modell: null },
    { schluessel: "anna", name: "Anna Brandt", rolle: "planer", modell: "buero" },
    { schluessel: "sandra", name: "Sandra Kowalski", rolle: "mitarbeiter", modell: "vollzeit" },
    { schluessel: "max", name: "Max Petersen", rolle: "mitarbeiter", modell: "vollzeit" },
    { schluessel: "leon", name: "Leon Schulz", rolle: "mitarbeiter", modell: "ausbildung" },
  ],
};

const MINIJOB: Modell = {
  name: "Minijob",
  sollMinuten: [0, 0, 0, 0, 0, 0, 0],
  lohnArt: "stunde",
  // the minimum wage of 2026 (§ 1 MiLoG, MiLoV5); the rules check it against the year's value
  lohnCent: 1_390,
  minijob: true,
};

export const CAFE: Betrieb = {
  schluessel: "cafe",
  name: "Café Elbblick",
  slug: "cafe-elbblick",
  email: "mia@cafe-elbblick.test",
  standort: { name: "Café am Elbhang", adresse: "Elbchaussee 7, 22763 Hamburg" },
  fragen: { beschaeftigte: true, schichten: true, kunden: false, stempelort: true },
  // § 5 Abs. 2 and § 10 Abs. 1 Nr. 4 ArbZG: Gaststätten work on Sundays and holidays
  pruefung: { branche: "gastronomie_beherbergung", sonntagsausnahme: 4 },
  modelle: {
    // each pattern of days as the rota has it (Monday is the café's day off)
    tom: monat("Vollzeit Di–Sa", [0, 450, 450, 450, 450, 450, 0], 265_000),
    lea: monat("Vollzeit Di–Fr, So", [0, 450, 450, 450, 450, 0, 450], 265_000),
    yusuf: monat("Vollzeit Mi–So", [0, 0, 450, 450, 450, 450, 450], 265_000),
    minijob: MINIJOB,
  },
  personen: [
    { schluessel: "mia", name: "Mia Hansen", rolle: "inhaber", modell: null },
    { schluessel: "tom", name: "Tom Becker", rolle: "mitarbeiter", modell: "tom", pin: "418203" },
    // Lea leads the shifts and plans them
    { schluessel: "lea", name: "Lea Vogel", rolle: "planer", modell: "lea", pin: "529314" },
    {
      schluessel: "yusuf",
      name: "Yusuf Demir",
      rolle: "mitarbeiter",
      modell: "yusuf",
      pin: "630425",
    },
    {
      schluessel: "olena",
      name: "Olena Kovalenko",
      rolle: "mitarbeiter",
      modell: "minijob",
      pin: "741536",
    },
    {
      schluessel: "piotr",
      name: "Piotr Nowak",
      rolle: "mitarbeiter",
      modell: "minijob",
      pin: "852647",
    },
  ],
};

export const BETRIEBE = [WEBER, CAFE] as const;

/** Leon is 17 throughout the demo: born 17 years and 150 days before `heute` */
export const geburtstagVonLeon = (heute: Tag): Tag => {
  const [jahr = 0, rest = ""] = [Number(heute.slice(0, 4)), heute.slice(4)];
  const vor17 = `${String(jahr - 17).padStart(4, "0")}${rest === "-02-29" ? "-02-28" : rest}`;
  return plusTage(vor17, -150);
};

/** The one password of every demo account: printed by the run and in docs/demo.md, demo only */
export const DEMO_PASSWORT = "soll-demo-2026";

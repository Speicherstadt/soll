/*
 * The items of a month that go to payroll (S-308): hours in whole minutes and amounts in whole cents
 * (CLAUDE.md, "Never"). Which wage type (Lohnart) of the payroll program each item books to is the
 * business's choice, made with its payroll office (docs/plan.md, "Lohnarten je Betrieb").
 */

/**
 * Items counted in hours: worked hours of an hourly wage and of an hourly mini-job, the hours a
 * holiday took from an hourly wage (§ 2 Abs. 1 EntgFG, Soll's `ausfallMinuten`), the hours credited
 * for an absence (docs/konten.md, S-401) and overtime paid out of the account (S-208).
 */
export const STUNDEN_POSTEN = [
  "stunden",
  "minijob",
  "feiertag",
  "urlaub",
  "krank",
  "kind_krank",
  "sonderurlaub",
  "ueberstunden",
] as const;

/**
 * Items counted in cents: the surcharges of S-207 per kind, the part free of tax under § 3b EStG
 * apart from the taxable rest, as the tax-free part is no wage for wage tax and social insurance
 * (§ 3b EStG, § 1 Abs. 1 Satz 1 Nr. 1 SvEV) and payroll books the two to different wage types
 */
export const BETRAG_POSTEN = [
  "nacht_steuerfrei",
  "nacht_steuerpflichtig",
  "sonntag_steuerfrei",
  "sonntag_steuerpflichtig",
  "feiertag_steuerfrei",
  "feiertag_steuerpflichtig",
] as const;

export const POSTENARTEN = [...STUNDEN_POSTEN, ...BETRAG_POSTEN] as const;

export type Stundenposten = (typeof STUNDEN_POSTEN)[number];
export type Betragposten = (typeof BETRAG_POSTEN)[number];
export type Postenart = (typeof POSTENARTEN)[number];

/** One item of a person's month: minutes for an hours item, cents for an amount */
export type Posten = { art: Stundenposten; minuten: number } | { art: Betragposten; cent: number };

export const istStundenposten = (art: Postenart): art is Stundenposten =>
  (STUNDEN_POSTEN as readonly string[]).includes(art);

/** A person's month for payroll: the items, each kind at most once, none zero */
export type Lohnmonat = { nutzerId: string; posten: Posten[] };

/** The wage type number per item; an item without one cannot be exported ("nicht hinterlegt") */
export type Lohnarten = Partial<Record<Postenart, string>>;

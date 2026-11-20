import type { Tag } from "../kalender/tag.ts";
import type { Tagesspanne } from "../pruefung-mutterschutz/typen.ts";

/** Whole minutes per weekday, Monday first, as `arbeitszeitmodelle.soll_minuten` stores them */
export type Wochenminuten = readonly number[];

/**
 * A working-time model as it holds for a person from a day on (`modellzuordnungen`): its minutes
 * per weekday and, for leave, the leave per year the model gives in its working days, in half days
 * (docs/regeln.md, R-23) and its working days per week where the minutes do not show them (a mini-job
 * "nach Plan" has no fixed minutes). Missing leave is the statutory minimum.
 */
export type Modellabschnitt = {
  ab: Tag;
  sollMinuten: Wochenminuten;
  urlaubHalbtage?: number | null;
  arbeitstageJeWoche?: number | null;
};

/**
 * The employment: its first and last day, both included, and the spans in which it rests (full
 * parental leave, unpaid leave): no Soll on those days
 */
export type Beschaeftigung = {
  eintritt: Tag;
  austritt?: Tag | null;
  ruhend?: readonly Tagesspanne[];
};

/** The kinds of absence (BAULISTE.md S-401) */
export const ABWESENHEITSARTEN = [
  "urlaub",
  "krank",
  "kind_krank",
  "sonderurlaub",
  "ueberstundenabbau",
] as const;

export type Abwesenheitsart = (typeof ABWESENHEITSARTEN)[number];

/**
 * An absence on one day, a whole or a half one. Sickness carries only whether a certificate is
 * there (Art. 9 DSGVO, docs/plan.md "Bescheinigungen"), Kind krank which child it is for (R-28).
 */
export type Abwesenheit = {
  tag: Tag;
  art: Abwesenheitsart;
  halb?: boolean;
  bescheinigung?: boolean;
  kind?: string;
};

export type { Tagesspanne };

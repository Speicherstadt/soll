import {
  type Abwesenheitsart,
  type Arbeitstag,
  alsLohnzuschlaege,
  arbeitstage,
  feiertage,
  type Grundlohn,
  type Modellabschnitt,
  type Monat,
  modellAm,
  monatVon,
  type Standort,
  type Stempelart,
  type Tag,
  type Zuschlagssaetze,
  zuschlaege,
} from "@soll/arbeitszeit";
import {
  istStundenposten,
  type Lohnmonat,
  POSTENARTEN,
  type Posten,
  type Postenart,
} from "./posten.ts";

/*
 * A person's closed month as payroll takes it (S-308): pure, from the records the month was closed
 * with (S-306), so the numbers cannot change after the export. Hours are counted in whole minutes and
 * rounded only in the file (zahlen.ts); surcharges come from `zuschlaege()` of S-207 in whole cents.
 */

/** A working-time model in force from a day on, as payroll needs it */
export type Lohnmodell = Modellabschnitt & {
  lohnArt: "monat" | "stunde";
  /** null: the wage is "nicht hinterlegt" */
  lohnCent: number | null;
  minijob: boolean;
  zuschlagssaetze: Zuschlagssaetze;
};

/**
 * A day as the month was closed: its stamps in force, the minutes of the person's model and its
 * call-outs from a Rufbereitschaft (S-505), which are working time like stamped work
 */
export type LohnAufzeichnung = {
  tag: Tag;
  stempel: readonly (readonly [Stempelart, number])[];
  modellMinuten: number | null;
  einsaetze?: readonly (readonly [number, number | null])[];
};

/** An absence credited with hours (docs/konten.md); taking off overtime is paid by the account */
export type Lohnabwesenheit = {
  tag: Tag;
  art: Exclude<Abwesenheitsart, "ueberstundenabbau">;
  minuten: number;
};

export type LohnmonatEingabe = {
  nutzerId: string;
  monat: Monat;
  tage: readonly LohnAufzeichnung[];
  /** counter-entries booked in this month (S-306), each to its model by the day it corrects */
  gegeneintraege: readonly { tag: Tag; minuten: number }[];
  modelle: readonly Lohnmodell[];
  /** the place whose holidays count; null when the business has none ("nicht hinterlegt") */
  standort: Standort | null;
  /** absences of the month (S-401), until then none */
  abwesenheiten?: readonly Lohnabwesenheit[];
  /** overtime paid out of the account in this month (S-208), until then none */
  ueberstundenMinuten?: number;
};

/** What keeps a month from payroll, with the days it concerns */
export type Lohnproblem = {
  art: "modell" | "lohn" | "feiertage" | "zuschlaege" | "negativ";
  nutzerId: string;
  tage: Tag[];
};

export type LohnmonatErgebnis =
  | { ok: true; wert: Lohnmonat }
  | { ok: false; probleme: Lohnproblem[] };

type Summen = Map<Postenart, number>;

const dazu = (summen: Summen, art: Postenart, wert: number) =>
  summen.set(art, (summen.get(art) ?? 0) + wert);

/** The hours item an hourly model books worked time to; a monthly wage pays it already */
const stundenpostenVon = (modell: Lohnmodell): Postenart | null =>
  modell.lohnArt === "monat" ? null : modell.minijob ? "minijob" : "stunden";

/**
 * The working days of the month, rebuilt from the stamps it was closed with and its call-outs read
 * as the same times stamped (R-12, R-29, `arbeitstage`): a call-out gets the hours, the model and
 * the surcharges the same times stamped would get, the 40 % from 0 to 4 Uhr after a start before
 * 0 Uhr included (§ 3b Abs. 3 Nr. 1 EStG, reviews of S-505)
 */
const arbeitstageAus = (eingabe: LohnmonatEingabe): Arbeitstag[] => {
  const stempel = eingabe.tage.flatMap((tag) =>
    tag.stempel.map(([art, zeitpunkt]) => ({ art, zeitpunkt })),
  );
  const einsaetze = eingabe.tage.flatMap((tag) =>
    (tag.einsaetze ?? []).map(([beginn, ende]) => ({ beginn, ende })),
  );
  const jetzt = Math.max(0, ...stempel.map((s) => s.zeitpunkt));
  const ergebnis = arbeitstage(stempel, jetzt, einsaetze);
  if (!ergebnis.ok) throw new Error("lohnmonat: stamps of a closed month are invalid");
  return ergebnis.wert.filter((tag) => monatVon(tag.tag) === eingabe.monat);
};

/** Worked hours and counter-entries per hours item, by the model of each day */
const gearbeitet = (
  eingabe: LohnmonatEingabe,
  tage: readonly Arbeitstag[],
  summen: Summen,
): Lohnproblem[] => {
  const ohneModell: Tag[] = [];
  const buchen = (tag: Tag, minuten: number) => {
    if (minuten === 0) return;
    const modell = modellAm(eingabe.modelle, tag);
    if (modell === null) return ohneModell.push(tag);
    const art = stundenpostenVon(modell);
    if (art !== null) dazu(summen, art, minuten);
  };
  for (const tag of tage) buchen(tag.tag, tag.arbeitsMinuten);
  for (const eintrag of eingabe.gegeneintraege) buchen(eintrag.tag, eintrag.minuten);
  return ohneModell.length > 0
    ? [{ art: "modell", nutzerId: eingabe.nutzerId, tage: [...new Set(ohneModell)].sort() }]
    : [];
};

/** The holidays of the years of some days at the place; null when one year is not known */
const feiertageVon = (standort: Standort | null, tage: readonly Tag[]): Set<Tag> | null => {
  if (standort === null) return null;
  const set = new Set<Tag>();
  for (const jahr of new Set(tage.map((tag) => Number(tag.slice(0, 4))))) {
    const ergebnis = feiertage(jahr, standort);
    if (!ergebnis.ok) return null;
    for (const feiertag of ergebnis.feiertage) set.add(feiertag.tag);
  }
  return set;
};

/**
 * The hours a holiday took from an hourly wage: the model's minutes of the day (Soll's
 * `ausfallMinuten`, docs/konten.md), less the minutes worked on it, since only time that „infolge
 * eines gesetzlichen Feiertages ausfällt“ is paid (§ 2 Abs. 1 EntgFG); a monthly wage goes on as it is
 */
const feiertagsstunden = (
  eingabe: LohnmonatEingabe,
  tage: readonly Arbeitstag[],
  summen: Summen,
): Lohnproblem[] => {
  const stuendlich = eingabe.tage.filter(
    (tag) =>
      (tag.modellMinuten ?? 0) > 0 && modellAm(eingabe.modelle, tag.tag)?.lohnArt === "stunde",
  );
  if (stuendlich.length === 0) return [];
  const amOrt = feiertageVon(
    eingabe.standort,
    stuendlich.map((tag) => tag.tag),
  );
  if (amOrt === null)
    return [{ art: "feiertage", nutzerId: eingabe.nutzerId, tage: stuendlich.map((t) => t.tag) }];
  const gearbeitetAm = new Map(tage.map((tag) => [tag.tag, tag.arbeitsMinuten]));
  for (const tag of stuendlich.filter((t) => amOrt.has(t.tag))) {
    const ausfall = (tag.modellMinuten ?? 0) - (gearbeitetAm.get(tag.tag) ?? 0);
    if (ausfall > 0) dazu(summen, "feiertag", ausfall);
  }
  return [];
};

const zahltZuschlaege = (saetze: Zuschlagssaetze): boolean =>
  Object.values(saetze).some((satz) => (satz ?? 0) > 0);

/** The Grundlohn of § 3b Abs. 2 EStG from a model (docs/zuschlaege.md, "Grundlohn") */
const grundlohnVon = (modell: Lohnmodell, cent: number, tage: readonly Arbeitstag[]): Grundlohn => {
  if (modell.lohnArt === "stunde") return { art: "stunde", cent };
  const wochenMinuten = modell.sollMinuten.reduce((a, b) => a + b, 0);
  if (wochenMinuten > 0) return { art: "monat", cent, wochenMinuten };
  const istMinuten = tage.reduce((summe, tag) => summe + tag.arbeitsMinuten, 0);
  // without a minute worked there is no surcharge to pay; 1 only keeps the Grundlohn defined
  return { art: "monat", cent, wochenMinuten: null, istMinuten: Math.max(istMinuten, 1) };
};

/** The surcharges of the days of one model, or what keeps them from being computed */
const zuschlaegeEinesModells = (
  eingabe: LohnmonatEingabe,
  modell: Lohnmodell,
  tage: readonly Arbeitstag[],
  summen: Summen,
): Lohnproblem[] => {
  const problem = (art: Lohnproblem["art"], liste: readonly Tag[]): Lohnproblem[] => [
    { art, nutzerId: eingabe.nutzerId, tage: [...liste] },
  ];
  const alle = tage.map((tag) => tag.tag);
  if (modell.lohnCent === null) return problem("lohn", alle);
  if (eingabe.standort === null) return problem("feiertage", alle);
  const ergebnis = zuschlaege(tage, {
    grundlohn: grundlohnVon(modell, modell.lohnCent, tage),
    saetze: modell.zuschlagssaetze,
    standort: eingabe.standort,
  });
  if (!ergebnis.ok) throw new Error("lohnmonat: invalid surcharge input");
  if (ergebnis.wert.nichtHinterlegt.length > 0)
    return problem("zuschlaege", ergebnis.wert.nichtHinterlegt);
  for (const z of alsLohnzuschlaege(ergebnis.wert.tage))
    dazu(summen, `${z.art}_${z.steuerfrei ? "steuerfrei" : "steuerpflichtig"}`, z.cent);
  return [];
};

/** Surcharges (§ 3b EStG, S-207) per model of the month: each model pays its own rates */
const zuschlaegeDesMonats = (
  eingabe: LohnmonatEingabe,
  tage: readonly Arbeitstag[],
  summen: Summen,
): Lohnproblem[] => {
  const jeModell = new Map<Lohnmodell, Arbeitstag[]>();
  for (const tag of tage) {
    const modell = modellAm(eingabe.modelle, tag.tag);
    if (modell === null || !zahltZuschlaege(modell.zuschlagssaetze)) continue;
    jeModell.set(modell, [...(jeModell.get(modell) ?? []), tag]);
  }
  return [...jeModell].flatMap(([modell, liste]) =>
    zuschlaegeEinesModells(eingabe, modell, liste, summen),
  );
};

const posten = (summen: Summen): Posten[] =>
  POSTENARTEN.flatMap((art): Posten[] => {
    const wert = summen.get(art) ?? 0;
    if (wert === 0) return [];
    return istStundenposten(art) ? [{ art, minuten: wert }] : [{ art, cent: wert }];
  });

/**
 * The items of a closed month: worked hours of an hourly wage (`stunden`, `minijob`), the hours a
 * holiday took from it (`feiertag`), absences and overtime paid out as hours, and the surcharges of
 * § 3b EStG in cents, the tax-free part apart from the taxable rest. A monthly wage itself is master
 * data in payroll and is no item. Whatever is "nicht hinterlegt" is named, not guessed (CLAUDE.md).
 */
export const lohnmonat = (eingabe: LohnmonatEingabe): LohnmonatErgebnis => {
  const tage = arbeitstageAus(eingabe);
  const summen: Summen = new Map();
  const probleme = [
    ...gearbeitet(eingabe, tage, summen),
    ...feiertagsstunden(eingabe, tage, summen),
    ...zuschlaegeDesMonats(eingabe, tage, summen),
  ];
  for (const abwesenheit of eingabe.abwesenheiten ?? [])
    dazu(summen, abwesenheit.art, abwesenheit.minuten);
  dazu(summen, "ueberstunden", eingabe.ueberstundenMinuten ?? 0);
  const negativ = [...summen].filter(([, wert]) => wert < 0);
  if (negativ.length > 0) probleme.push({ art: "negativ", nutzerId: eingabe.nutzerId, tage: [] });
  return probleme.length > 0
    ? { ok: false, probleme }
    : { ok: true, wert: { nutzerId: eingabe.nutzerId, posten: posten(summen) } };
};

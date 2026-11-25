import {
  type Abwesenheit,
  arbeitstage,
  arbeitstagMit,
  type Befund,
  beginnInBerlin,
  bereitschaftstage,
  ersterTag,
  letzterTag,
  type Monat,
  type Monatsstand,
  monatVon,
  plusMonate,
  plusTage,
  type Stempelart,
  type Stempelung,
  stempelSchluessel,
  stempeltage,
  type Tag,
  tageImMonat,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { kanonisch, sha256 } from "../audit/hash.ts";

/*
 * The content of a month of one person as it is closed (S-306): pure functions, no database. Its hash
 * stands in the row of the closing and so in the audit chain; the Prüfwert the person gets is the link
 * of that row. The check page compares the records kept here with what the database holds now.
 */

/** An absence of the day as the month records it: its kind, half, certificate there, child (S-401) */
export type Tagesabwesenheit = Omit<Abwesenheit, "tag">;

/**
 * What a day records: its stamps in force, in time order, the minutes of the person's model and its
 * approved absences. A day without an absence has no key `abwesenheiten` at all, so the content of a
 * month closed before S-401 stays what it was and its Prüfwert keeps matching.
 */
export type Aufzeichnung = {
  tag: Tag;
  stempel: [Stempelart, number][];
  /** the model's minutes for the weekday; null without a model ("nicht hinterlegt") */
  modellMinuten: number | null;
  abwesenheiten?: Tagesabwesenheit[];
  /**
   * S-505: the call-outs of the working day, beginning and end (null while one runs), and on a day
   * whose Soll comes from the plan its published minutes; both only where there are any, so the
   * content of a month closed before stays what it was
   */
  einsaetze?: [number, number | null][];
  planMinuten?: number;
};

/** A call-out from a Rufbereitschaft: from the call to the end of work, open while it runs */
export type Einsatzspanne = { beginn: number; ende: number | null };

/** What a month records besides stamps, model and absences (S-505) */
export type Weitere = {
  einsaetze?: readonly Einsatzspanne[];
  /** the days whose Soll comes from the plan, with the person's published minutes */
  plan?: ReadonlyMap<Tag, number>;
};

/** A finding as the time sheet shows it: rule, norm (German in every language), severity, days */
export type Blattbefund = Pick<Befund, "regel" | "norm" | "schwere" | "art" | "tage">;

export type Summen = Pick<
  Monatsstand,
  "sollMinuten" | "gearbeitetMinuten" | "gutschriftMinuten" | "istMinuten" | "saldoMinuten"
>;

/** A counter-entry to a day of a closed month, counted in the month it was entered in */
export type Gegeneintrag = { tag: Tag; minuten: number; grund: string };

/** The month as it is confirmed and closed; `fassung` changes when the form ever changes */
export type Monatsinhalt = {
  fassung: 1;
  monat: Monat;
  nutzerId: string;
  tage: Aufzeichnung[];
  /** null: the month's Soll is "nicht hinterlegt" on the days in `nichtHinterlegt` */
  summen: Summen | null;
  nichtHinterlegt: Tag[];
  befunde: Blattbefund[];
  /** counter-entries to closed months entered in this month; Ist and balance include them */
  gegeneintraege: Gegeneintrag[];
};

/**
 * The stamps a month is read from (UTC milliseconds, `bis` exclusive), by closing, the check page and
 * the lock alike: a shift ends 24 h after its start at the latest, so with shifts under 9 h apart
 * where one ends depends on where the chain began, days back. Reading every month from the same
 * window keeps the three in step. It begins six months back (with two days for a night shift), as a
 * period of R-03 reaching into the month began at most that long before, and ends two days after.
 */
export const lesefenster = (monat: Monat): { von: number; bis: number } => ({
  von: beginnInBerlin(plusTage(ersterTag(plusMonate(monat, -6)), -2)),
  bis: beginnInBerlin(plusTage(letzterTag(monat), 3)),
});

/**
 * What the content records of the absences of one day, in the order given, without their day: the
 * certificate of a sickness only on a day with leave, the only day it changes Soll and Ist (§ 9
 * BUrlG, R-24). Elsewhere it is no part of the working time, and marking it after the month was
 * closed must stay possible (docs/plan.md, "Frist und Erinnerung der Bescheinigung").
 */
export const amTag = (abwesenheiten: readonly Abwesenheit[], tag: Tag): Tagesabwesenheit[] => {
  const tages = abwesenheiten.filter((a) => a.tag === tag);
  const urlaub = tages.some((a) => a.art === "urlaub");
  return tages.map(({ tag: _, bescheinigung, ...rest }) =>
    urlaub && bescheinigung === true ? { ...rest, bescheinigung } : rest,
  );
};

/**
 * The working day of each call-out (R-12): the day of the shift it joins, of stamped work within
 * 9 hours before it, else the day it begins on. The stamps are read up to the end of the month's
 * window, so closing, the check page and the lock assign them alike.
 */
export const einsatzTage = (
  monat: Monat,
  stempelungen: readonly Stempelung[],
  einsaetze: readonly Einsatzspanne[],
): Tag[] => {
  const ergebnis = arbeitstage(stempelungen, lesefenster(monat).bis);
  const geschlossen = einsaetze.flatMap(({ beginn, ende }) =>
    ende === null ? [] : [{ beginn, ende }],
  );
  const mit = ergebnis.ok ? bereitschaftstage(ergebnis.wert, { einsaetze: geschlossen }) : null;
  const tage = mit?.ok ? mit.wert : ergebnis.ok ? ergebnis.wert : [];
  return einsaetze.map(({ beginn }) => arbeitstagMit(tage, beginn) ?? tagInBerlin(beginn));
};

/** The minutes of a day's call-outs that have ended: working time (R-12) */
export const einsatzMinuten = (einsaetze: readonly [number, number | null][] = []): number =>
  einsaetze.reduce(
    (summe, [beginn, ende]) => summe + (ende === null ? 0 : Math.round((ende - beginn) / 60_000)),
    0,
  );

/** The call-outs of each working day, in time order */
const einsaetzeJeTag = (
  monat: Monat,
  stempelungen: readonly Stempelung[],
  einsaetze: readonly Einsatzspanne[],
): Map<Tag, [number, number | null][]> => {
  const sortiert = [...einsaetze].sort((a, b) => a.beginn - b.beginn);
  const tage = einsatzTage(monat, stempelungen, sortiert);
  const jeTag = new Map<Tag, [number, number | null][]>();
  sortiert.forEach(({ beginn, ende }, index) => {
    const tag = tage[index] as Tag;
    jeTag.set(tag, [...(jeTag.get(tag) ?? []), [beginn, ende]]);
  });
  return jeTag;
};

/**
 * The records of every day of the month: each stamp goes to the working day of its shift (a night
 * shift's Gehen after midnight to the day the shift began; CLAUDE.md, "Time"), each approved absence
 * to its day, each call-out to its working day (R-12). Pass the stamps and call-outs of
 * `lesefenster(monat)`.
 */
export const aufzeichnungen = (
  monat: Monat,
  stempelungen: readonly Stempelung[],
  modellMinuten: (tag: Tag) => number | null,
  abwesenheiten: readonly Abwesenheit[] = [],
  weitere: Weitere = {},
): Aufzeichnung[] => {
  const sortiert = [...stempelungen].sort((a, b) => a.zeitpunkt - b.zeitpunkt);
  const tagVon = stempeltage(sortiert);
  const jeTag = new Map<Tag, [Stempelart, number][]>();
  for (const stempel of sortiert) {
    const tag = tagVon.get(stempelSchluessel(stempel));
    if (tag === undefined || monatVon(tag) !== monat) continue;
    jeTag.set(tag, [...(jeTag.get(tag) ?? []), [stempel.art, stempel.zeitpunkt]]);
  }
  const einsaetze = einsaetzeJeTag(monat, sortiert, weitere.einsaetze ?? []);
  return tageImMonat(monat).map((tag) => {
    const abwesend = amTag(abwesenheiten, tag);
    const einsatz = einsaetze.get(tag) ?? [];
    const plan = weitere.plan?.get(tag);
    return {
      tag,
      stempel: jeTag.get(tag) ?? [],
      modellMinuten: modellMinuten(tag),
      ...(abwesend.length > 0 ? { abwesenheiten: abwesend } : {}),
      ...(einsatz.length > 0 ? { einsaetze: einsatz } : {}),
      ...(plan === undefined ? {} : { planMinuten: plan }),
    };
  });
};

/** A finding reduced to what the sheet shows, so extra fields of a rule do not enter the hash */
export const alsBlattbefund = ({ regel, norm, schwere, art, tage }: Befund): Blattbefund => ({
  regel,
  norm,
  schwere,
  art,
  tage: [...tage],
});

export const monatsinhalt = (angaben: {
  monat: Monat;
  nutzerId: string;
  tage: Aufzeichnung[];
  summen: Summen | null;
  nichtHinterlegt: readonly Tag[];
  befunde: readonly Befund[];
  gegeneintraege?: readonly Gegeneintrag[];
}): Monatsinhalt => ({
  fassung: 1,
  monat: angaben.monat,
  nutzerId: angaben.nutzerId,
  tage: angaben.tage,
  summen: angaben.summen,
  nichtHinterlegt: [...angaben.nichtHinterlegt],
  befunde: angaben.befunde.map(alsBlattbefund),
  gegeneintraege: (angaben.gegeneintraege ?? []).map(({ tag, minuten, grund }) => ({
    tag,
    minuten,
    grund,
  })),
});

/** The hash of a month's content: SHA-256 of its canonical JSON (sorted keys, whole numbers only) */
export const inhaltHash = (inhalt: Monatsinhalt): string => sha256(kanonisch(inhalt));

/** The days whose records differ between the month as closed and as it stands now, in order */
export const abweichendeTage = (
  abgeschlossen: readonly Aufzeichnung[],
  jetzt: readonly Aufzeichnung[],
): Tag[] => {
  const vorher = new Map(abgeschlossen.map((tag) => [tag.tag, kanonisch(tag)]));
  const nachher = new Map(jetzt.map((tag) => [tag.tag, kanonisch(tag)]));
  return [...new Set([...vorher.keys(), ...nachher.keys()])]
    .filter((tag) => vorher.get(tag) !== nachher.get(tag))
    .sort();
};

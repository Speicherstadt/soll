import type { Standort } from "../feiertage/laender.ts";
import type { Tag } from "../kalender/tag.ts";
import { geschlossen, type PruefTag, sortiert } from "../pruefung/typen.ts";
import type { Zuschlag } from "../pruefung-lohn/lohn.ts";
import {
  type Betrag,
  einheitenJeCent,
  inCent,
  KEIN_TEIL,
  mitRaum,
  plus,
  type Raum,
  type Teil,
  teileVon,
} from "./betrag.ts";
import { type ZuschlagGrenzen, zuschlagGrenzenAm } from "./grenzen.ts";
import {
  type Bruch,
  type Grundlohn,
  gedeckelt,
  grundlohnGueltig,
  grundlohnJeStunde,
} from "./grundlohn.ts";
import { type Lage, lagen } from "./lage.ts";
import {
  gezahlteSaetze,
  type Satzpaar,
  saetzeGueltig,
  steuerfreieSaetze,
  type Zuschlagssaetze,
} from "./saetze.ts";

/** The kinds of surcharge as payroll (S-204) and DATEV (S-308) take them */
export type ZuschlagArt = Zuschlag["art"];

/** A stretch of work with the rates that hold for each of its minutes, in basis points */
export type Zuschlagsabschnitt = Lage & { gezahlt: Satzpaar; steuerfrei: Satzpaar };

/**
 * The surcharges of one working day (the day its shifts begin, CLAUDE.md "Time"): the stretches and,
 * per kind and together, what is paid, what of it is tax-free under § 3b EStG and the taxable rest
 */
export type Zuschlagstag = {
  tag: Tag;
  abschnitte: Zuschlagsabschnitt[];
  arten: Record<ZuschlagArt, Betrag>;
  summe: Betrag;
};

export type ZuschlagOptionen = {
  /** the Grundlohn of the pay period (§ 3b Abs. 2 Satz 1 EStG); the business's rates apply to it too */
  grundlohn: Grundlohn;
  saetze: Zuschlagssaetze;
  /** the place of work: its holidays count (§ 3b Abs. 2 Satz 4 EStG) */
  standort: Standort;
};

export type ZuschlagErgebnis =
  | { ok: true; wert: { tage: Zuschlagstag[]; nichtHinterlegt: Tag[] } }
  | { ok: false; grund: "ungueltig" };

const MINUTE = 60_000;
const ARTEN: readonly ZuschlagArt[] = ["nacht", "sonntag", "feiertag"];

const tageGueltig = (tage: readonly PruefTag[]): boolean =>
  tage.every((tag) =>
    geschlossen(tag).every((schicht) =>
      schicht.bloecke.every(
        (block) =>
          block.beginn % MINUTE === 0 && block.ende % MINUTE === 0 && block.ende > block.beginn,
      ),
    ),
  );

type Lohnsatz = { stundenlohn: Bruch; gedeckelt: Bruch };

/** The stretches of a working day with their rates; null when a day's holidays are not known */
const abschnitteAm = (
  tag: PruefTag,
  optionen: ZuschlagOptionen,
  grenzen: ZuschlagGrenzen,
): Zuschlagsabschnitt[] | null => {
  const abschnitte: Zuschlagsabschnitt[] = [];
  for (const schicht of geschlossen(tag)) {
    const liste = lagen(schicht.bloecke, optionen.standort, grenzen);
    if (liste === null) return null;
    for (const lage of liste)
      abschnitte.push({
        ...lage,
        gezahlt: gezahlteSaetze(lage, optionen.saetze),
        steuerfrei: steuerfreieSaetze(lage, grenzen),
      });
  }
  return abschnitte;
};

/**
 * The exact sums of a day per kind, the day part going to Sunday or holiday by its kind of day, and
 * the room each stretch leaves under its limits
 */
const summenJeArt = (
  abschnitte: readonly Zuschlagsabschnitt[],
  lohn: Lohnsatz,
): { summen: Record<ZuschlagArt, Teil>; raeume: Raum<ZuschlagArt>[] } => {
  const summen: Record<ZuschlagArt, Teil> = {
    nacht: KEIN_TEIL,
    sonntag: KEIN_TEIL,
    feiertag: KEIN_TEIL,
  };
  const raeume: Raum<ZuschlagArt>[] = [];
  for (const a of abschnitte) {
    const teile = teileVon(a.minuten, lohn.stundenlohn, lohn.gedeckelt, a.gezahlt, a.steuerfrei);
    const tagesart = a.steuerfrei.tagesart ?? a.gezahlt.tagesart;
    const artDesTags: ZuschlagArt = tagesart === "sonntag" ? "sonntag" : "feiertag";
    summen.nacht = plus(summen.nacht, teile.nacht);
    summen[artDesTags] = plus(summen[artDesTags], teile.tag);
    const gezahlt: ZuschlagArt[] = [
      ...(teile.nacht.gezahlt > 0n ? (["nacht"] as const) : []),
      ...(teile.tag.gezahlt > 0n ? [artDesTags] : []),
    ];
    if (gezahlt.length > 0 && teile.raum > 0n) raeume.push({ arten: gezahlt, raum: teile.raum });
  }
  return { summen, raeume };
};

const zusammen = (betraege: readonly Betrag[]): Betrag =>
  betraege.reduce(
    (s, b) => ({
      gezahltCent: s.gezahltCent + b.gezahltCent,
      steuerfreiCent: s.steuerfreiCent + b.steuerfreiCent,
      steuerpflichtigCent: s.steuerpflichtigCent + b.steuerpflichtigCent,
    }),
    { gezahltCent: 0, steuerfreiCent: 0, steuerpflichtigCent: 0 },
  );

const zuschlagstag = (tag: PruefTag, optionen: ZuschlagOptionen): Zuschlagstag | null => {
  const grenzen = zuschlagGrenzenAm(tag.tag);
  if (grenzen === null) return null;
  const abschnitte = abschnitteAm(tag, optionen, grenzen);
  if (abschnitte === null) return null;
  const stundenlohn = grundlohnJeStunde(optionen.grundlohn, grenzen);
  const lohn = { stundenlohn, gedeckelt: gedeckelt(stundenlohn, grenzen) };
  const einheiten = einheitenJeCent(stundenlohn);
  const { summen: genau, raeume } = summenJeArt(abschnitte, lohn);
  const summen = mitRaum(genau, ARTEN, raeume, einheiten);
  const arten = Object.fromEntries(
    ARTEN.map((art) => [art, inCent(summen[art], einheiten)]),
  ) as Record<ZuschlagArt, Betrag>;
  return { tag: tag.tag, abschnitte, arten, summe: zusammen(Object.values(arten)) };
};

/**
 * § 3b EStG with R 3b LStR (docs/regeln.md, R-29): the surcharges the business pays for night,
 * Sunday and holiday work, per working day, each split into the part free of tax and the taxable
 * rest, in whole cents. Only closed shifts count. A day without a rule version or whose holidays are
 * not known is "nicht hinterlegt".
 */
export const zuschlaege = (
  tage: readonly PruefTag[],
  optionen: ZuschlagOptionen,
): ZuschlagErgebnis => {
  if (
    !grundlohnGueltig(optionen.grundlohn) ||
    !saetzeGueltig(optionen.saetze) ||
    !tageGueltig(tage)
  )
    return { ok: false, grund: "ungueltig" };
  const ergebnis: Zuschlagstag[] = [];
  const nichtHinterlegt: Tag[] = [];
  for (const tag of [...tage].sort((a, b) => a.tag.localeCompare(b.tag))) {
    const eintrag = zuschlagstag(tag, optionen);
    if (eintrag === null) nichtHinterlegt.push(tag.tag);
    else ergebnis.push(eintrag);
  }
  return { ok: true, wert: { tage: ergebnis, nichtHinterlegt: sortiert(nichtHinterlegt) } };
};

/**
 * The surcharges of working days as the wage rules of S-204 take them (`Lohnmonat.zuschlaege`): per
 * kind one entry for the tax-free part and one for the taxable rest, empty ones left out. Pass the
 * days of one month.
 */
export const alsLohnzuschlaege = (tage: readonly Zuschlagstag[]): Zuschlag[] =>
  ARTEN.flatMap((art) => {
    const summe = zusammen(tage.map((tag) => tag.arten[art]));
    return [
      { art, cent: summe.steuerfreiCent, steuerfrei: true },
      { art, cent: summe.steuerpflichtigCent, steuerfrei: false },
    ].filter((zuschlag) => zuschlag.cent > 0);
  });

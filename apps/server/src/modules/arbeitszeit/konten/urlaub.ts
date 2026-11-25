import {
  type GenommenerUrlaub,
  jahrVon,
  type Monat,
  type SollGrundlagen,
  type Tag,
  type Urlaubsanpassung,
  type Urlaubsjahr,
  type Urlaubskonto,
  type UrlaubskontoEingaben,
  urlaubAbStichtag,
  urlaubGenommen,
  urlaubsanspruch,
  urlaubskonto,
} from "@soll/arbeitszeit";
import type { Db } from "../../../db/oeffnen.ts";
import { abwesenheitenIn, tageDerAbwesenheiten } from "../abwesenheiten/lesen.ts";
import { tageMitSoll } from "../abwesenheiten/stand.ts";
import { sollGrundlagen } from "../grundlagen.ts";
import { type AnpassungZeile, anpassungenVon, ausgesondertAb, hinweiseVon } from "./lesen.ts";
import { type Urlaubsbeginn, urlaubsbeginnVon } from "./stichtag.ts";

/*
 * The leave account of a person (S-402, R-23): from the year Soll knows the leave from, each year's
 * leave, the approved leave, the changes by hand and the notices on leave expiring, as
 * `urlaubskonto` takes them.
 */

/** Why an account is not shown: a value it needs is missing, or months of it were removed */
export type KontoLuecke = {
  ok: false;
  grund: "nicht_hinterlegt" | "ausgesondert";
  monate: Monat[];
};

export type UrlaubsGrundlage = {
  ok: true;
  /** the first year of the account: of the leave brought in (`urlaub_start`), else of joining */
  startJahr: number;
  /** the first day the account holds: 1 January of `startJahr`, or the cut-off date (S-708) */
  beginn: Tag;
  /** the day the person joined, as Soll knows it (`beschaeftigungVon`) */
  eintritt: Tag;
  eingaben: UrlaubskontoEingaben;
  /** approved leave on days after today: still open, but planned */
  geplantHalbtage: number;
};

const NICHT_HINTERLEGT: KontoLuecke = { ok: false, grund: "nicht_hinterlegt", monate: [] };

const beginnVon = (anpassungen: readonly AnpassungZeile[], grundlagen: SollGrundlagen) =>
  urlaubsbeginnVon(anpassungen) ?? {
    jahr: jahrVon(grundlagen.beschaeftigung.eintritt),
    stichtag: null,
  };

/** The inputs from the cut-off date on, where the account begins on one (R-34) */
const abStichtag = (eingaben: UrlaubskontoEingaben, beginn: Urlaubsbeginn) => {
  if (beginn.stichtag === null) return eingaben;
  const ab = urlaubAbStichtag(eingaben, beginn.stichtag);
  return ab.ok ? ab.wert : null;
};

/**
 * The leave of each year from `start` to this one; Teilurlaub under § 5 Abs. 1 Buchst. a BUrlG is
 * carried into the whole next year, as if the person asked for it (§ 7 Abs. 3 Satz 4 BUrlG): Soll
 * does not know the request and takes the reading better for the person (docs/plan.md)
 */
const jahreVon = (grundlagen: SollGrundlagen, start: number, bis: number): Urlaubsjahr[] | null => {
  const jahre: Urlaubsjahr[] = [];
  for (let jahr = start; jahr <= bis; jahr += 1) {
    const anspruch = urlaubsanspruch({
      jahr,
      modelle: grundlagen.modelle,
      beschaeftigung: grundlagen.beschaeftigung,
    });
    if (!anspruch.ok) return null;
    const teilA = anspruch.wert.art === "teil_a";
    jahre.push({
      jahr,
      anspruchHalbtage: anspruch.wert.gesamtHalbtage,
      ...(teilA ? { teilurlaubA: true, uebertragungVerlangt: true } : {}),
    });
  }
  return jahre;
};

/** The leave brought in counts as leave of the year before the account begins */
const urlaubsAnpassungen = (zeilen: readonly AnpassungZeile[]): Urlaubsanpassung[] =>
  zeilen.flatMap((z) => {
    if (z.halbtage === null || z.jahr === null) return [];
    if (z.art === "urlaub_start") return [{ jahr: z.jahr - 1, halbtage: z.halbtage }];
    return z.art === "urlaub_korrektur" ? [{ jahr: z.jahr, halbtage: z.halbtage }] : [];
  });

/** Approved leave per day from `ab` on, charged as `tagesSoll` counts it (§ 9 BUrlG) */
const genommenAb = (
  db: Db,
  grundlagen: SollGrundlagen,
  wer: { betriebId: string; nutzerId: string },
  ab: Tag,
  heute: Tag,
): GenommenerUrlaub[] | null => {
  const zeilen = abwesenheitenIn(db, wer.betriebId, {
    nutzerId: wer.nutzerId,
    von: ab,
    bis: "9999-12-31",
    status: ["genehmigt"],
  });
  const tage = tageMitSoll(
    grundlagen,
    tageDerAbwesenheiten(zeilen, heute).filter((a) => a.tag >= ab),
  );
  return tage === null ? null : urlaubGenommen(tage);
};

/** What the leave account of a person on `heute` is computed from */
export const urlaubsGrundlage = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  heute: Tag,
): UrlaubsGrundlage | KontoLuecke => {
  const grundlagen = sollGrundlagen(db, betriebId, nutzerId);
  if (grundlagen === null) return NICHT_HINTERLEGT;
  const anpassungen = anpassungenVon(db, betriebId, nutzerId);
  const beginn = beginnVon(anpassungen, grundlagen);
  const startJahr = beginn.jahr;
  const ab: Tag = beginn.stichtag?.tag ?? `${String(startJahr).padStart(4, "0")}-01-01`;
  const ausgesondert = ausgesondertAb(db, betriebId, nutzerId, ab);
  if (ausgesondert.length > 0) return { ok: false, grund: "ausgesondert", monate: ausgesondert };
  const jahre = jahreVon(grundlagen, startJahr, jahrVon(heute));
  const genommen = genommenAb(db, grundlagen, { betriebId, nutzerId }, ab, heute);
  if (jahre === null || genommen === null) return NICHT_HINTERLEGT;
  const eingaben = abStichtag(
    {
      jahre,
      genommen: genommen.filter((g) => g.tag <= heute),
      anpassungen: urlaubsAnpassungen(anpassungen),
      hinweise: hinweiseVon(db, betriebId, nutzerId).map((h) => h.tag as Tag),
      heute,
    },
    beginn,
  );
  if (eingaben === null) return NICHT_HINTERLEGT;
  return {
    ok: true,
    startJahr,
    beginn: ab,
    eintritt: grundlagen.beschaeftigung.eintritt,
    eingaben,
    geplantHalbtage: genommen
      .filter((g) => g.tag > heute)
      .reduce((summe, g) => summe + g.halbtage, 0),
  };
};

export type UrlaubskontoStand =
  | { ok: true; startJahr: number; geplantHalbtage: number; konto: Urlaubskonto }
  | KontoLuecke;

/** The leave account of a person on `heute` */
export const urlaubskontoVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  heute: Tag,
): UrlaubskontoStand => {
  const grundlage = urlaubsGrundlage(db, betriebId, nutzerId, heute);
  if (!grundlage.ok) return grundlage;
  const konto = urlaubskonto(grundlage.eingaben);
  if (!konto.ok) return NICHT_HINTERLEGT;
  return {
    ok: true,
    startJahr: grundlage.startJahr,
    geplantHalbtage: grundlage.geplantHalbtage,
    konto: konto.wert,
  };
};

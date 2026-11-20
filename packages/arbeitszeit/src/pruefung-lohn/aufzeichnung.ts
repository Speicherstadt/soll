import { type Arbeitstag, arbeitstage } from "../arbeitstag/arbeitstag.ts";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import type { Befund } from "../befund.ts";
import { plusTage, type Tag } from "../kalender/tag.ts";
import { beginnInBerlin, tagInBerlin } from "../kalender/zeit.ts";
import { type Pruefergebnis, sortiert } from "../pruefung/typen.ts";
import { type LohnGrenzen, lohnGrenzenAm, type SchwarzArbGBranche } from "./grenzen.ts";
import type { LohnErgebnis } from "./lohn.ts";

/**
 * A version of a stamp as it was recorded (S-304): `erfasst` is when it was written, `ersetzt` when a
 * change or deletion replaced it (null or missing while it stands). A stamp changed once is two
 * versions: the old one replaced at the instant the new one was recorded. Instants in UTC ms.
 */
export type ErfassteStempelung = Stempelung & { erfasst: number; ersetzt?: number | null };

/**
 * Whom § 17 Abs. 1 MiLoG covers. `minijob` comes from the working-time model (§ 8 Abs. 1 SGB IV);
 * `privathaushalt` (§ 8a SGB IV, excepted by Satz 3) defaults to no; `branche` is the business's
 * industry under § 2a SchwarzArbG and, until the business sets it, counts as one of them: the duty
 * applies, never less strictly than the law.
 */
export type AufzeichnungOptionen = {
  minijob: boolean;
  privathaushalt?: boolean;
  branche?: SchwarzArbGBranche;
};

/**
 * R-13: a working day not complete (R-01) from the fifth day after it (`aufzeichnung_faellig`) or at
 * the end of the seventh (`aufzeichnung_verspaetet`). `frist` is the instant the time runs out (0:00
 * on the eighth day), `vollstaendigSeit` when the day as it stands now was recorded in full (null
 * while it is not).
 */
export type AufzeichnungBefund = Befund<"aufzeichnung_faellig" | "aufzeichnung_verspaetet"> & {
  frist: number;
  vollstaendigSeit: number | null;
};

/** The findings, the days not judged, and the days changed after their time ran out (nachgetragen) */
export type AufzeichnungErgebnis = Pruefergebnis<AufzeichnungBefund> & { nachgetragen: Tag[] };

export const aufzeichnungspflichtig = ({
  minijob,
  privathaushalt = false,
  branche,
}: AufzeichnungOptionen): boolean => !privathaushalt && (minijob || branche !== "andere");

const gueltig = (stempelungen: readonly ErfassteStempelung[], jetzt: number): boolean =>
  Number.isSafeInteger(jetzt) &&
  stempelungen.every(
    ({ erfasst, ersetzt }) =>
      Number.isSafeInteger(erfasst) &&
      (ersetzt === undefined ||
        ersetzt === null ||
        (Number.isSafeInteger(ersetzt) && ersetzt >= erfasst)),
  );

/** The stamps as they stood at an instant: recorded by then and not yet replaced */
const standAm = (stempelungen: readonly ErfassteStempelung[], zeitpunkt: number): Stempelung[] =>
  stempelungen
    .filter(({ erfasst, ersetzt }) => erfasst <= zeitpunkt && (ersetzt ?? Infinity) > zeitpunkt)
    .map(({ art, zeitpunkt: wann }) => ({ art, zeitpunkt: wann }));

/** The working days of the stamps as they stood at an instant, by day */
const tageAm = (stempelungen: readonly ErfassteStempelung[], zeitpunkt: number) => {
  const ergebnis = arbeitstage(standAm(stempelungen, zeitpunkt), zeitpunkt);
  return ergebnis.ok ? new Map(ergebnis.wert.map((tag) => [tag.tag, tag] as const)) : null;
};

/** The day a stamp belongs to: the day of the shift it falls in, else its own calendar day */
const tagDer = (zeitpunkt: number, tage: readonly Arbeitstag[]): Tag =>
  tage.find((tag) =>
    tag.schichten.some((s) => s.beginn <= zeitpunkt && (s.ende === null || zeitpunkt <= s.ende)),
  )?.tag ?? tagInBerlin(zeitpunkt);

type Kontext = {
  stempelungen: readonly ErfassteStempelung[];
  jetzt: number;
  tage: readonly Arbeitstag[];
};

/** When the day as it stands was recorded in full: its latest standing stamp; null if incomplete */
const vollstaendigSeit = (tag: Arbeitstag, kontext: Kontext): number | null => {
  if (!tag.vollstaendig) return null;
  const stehend = kontext.stempelungen.filter(
    (s) =>
      s.erfasst <= kontext.jetzt &&
      (s.ersetzt ?? Infinity) > kontext.jetzt &&
      tagDer(s.zeitpunkt, kontext.tage) === tag.tag,
  );
  return stehend.length === 0 ? null : Math.max(...stehend.map((s) => s.erfasst));
};

/** Whether a version of a stamp of the day was recorded or replaced from `frist` on */
const geaendertAb = (tag: Tag, frist: number, kontext: Kontext): boolean =>
  kontext.stempelungen.some(
    (s) =>
      tagDer(s.zeitpunkt, kontext.tage) === tag &&
      ((s.erfasst >= frist && s.erfasst <= kontext.jetzt) ||
        (s.ersetzt != null && s.ersetzt >= frist && s.ersetzt <= kontext.jetzt)),
  );

type Urteil = { befund: AufzeichnungBefund | null; nachgetragen: boolean };

const amTag = (tag: Arbeitstag, grenzen: LohnGrenzen, kontext: Kontext): Urteil => {
  const frist = beginnInBerlin(plusTage(tag.tag, grenzen.aufzeichnungTage + 1));
  const seit = vollstaendigSeit(tag, kontext);
  const befund = (art: AufzeichnungBefund["art"]): AufzeichnungBefund => ({
    regel: "R-13",
    norm: "§ 17 Abs. 1 Satz 1 MiLoG",
    schwere: art === "aufzeichnung_verspaetet" ? "verstoss" : "hinweis",
    art,
    tage: [tag.tag],
    frist,
    vollstaendigSeit: seit,
  });
  if (kontext.jetzt < frist) {
    const faellig = kontext.jetzt >= beginnInBerlin(plusTage(tag.tag, grenzen.hinweisAbTag));
    return {
      befund: faellig && seit === null ? befund("aufzeichnung_faellig") : null,
      nachgetragen: false,
    };
  }
  const damals = tageAm(kontext.stempelungen, frist - 1)?.get(tag.tag);
  return {
    befund: damals?.vollstaendig === true ? null : befund("aufzeichnung_verspaetet"),
    nachgetragen: geaendertAb(tag.tag, frist, kontext),
  };
};

/**
 * § 17 Abs. 1 MiLoG (docs/regeln.md, R-13): for mini-jobs and the industries of § 2a SchwarzArbG,
 * each working day must be complete (R-01) by the end of the seventh calendar day after it. The day
 * is judged as the stamps stood at that instant; what was recorded or changed later is allowed but
 * named in `nachgetragen`. Pass every version of the stamps from the day before the period on.
 */
export const aufzeichnungsfrist = (
  stempelungen: readonly ErfassteStempelung[],
  jetzt: number,
  optionen: AufzeichnungOptionen,
): LohnErgebnis<AufzeichnungErgebnis> => {
  if (!gueltig(stempelungen, jetzt)) return { ok: false, grund: "ungueltig" };
  const jetztTage = tageAm(stempelungen, jetzt);
  if (jetztTage === null) return { ok: false, grund: "ungueltig" };
  const leer = { befunde: [], nichtHinterlegt: [], nachgetragen: [] };
  if (!aufzeichnungspflichtig(optionen)) return { ok: true, wert: leer };
  const kontext: Kontext = { stempelungen, jetzt, tage: [...jetztTage.values()] };
  const befunde: AufzeichnungBefund[] = [];
  const nichtHinterlegt: Tag[] = [];
  const nachgetragen: Tag[] = [];
  for (const tag of kontext.tage) {
    const grenzen = lohnGrenzenAm(tag.tag);
    if (grenzen === null) {
      nichtHinterlegt.push(tag.tag);
      continue;
    }
    const urteil = amTag(tag, grenzen, kontext);
    if (urteil.befund !== null) befunde.push(urteil.befund);
    if (urteil.nachgetragen) nachgetragen.push(tag.tag);
  }
  return { ok: true, wert: { befunde, nichtHinterlegt: sortiert(nichtHinterlegt), nachgetragen } };
};

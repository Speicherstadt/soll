import type { Befund } from "../befund.ts";
import type { Standort } from "../feiertage/laender.ts";
import { plusTage, type Tag, tagAus, tageZwischen } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";
import { spaeterer } from "../pruefung/zeitraeume.ts";
import { type NachtSonntagGrenzen, nachtSonntagGrenzenAm } from "./grenzen.ts";
import type { Nachttag } from "./nachtzeit.ts";
import { ruhetagAm } from "./ruhetage.ts";
import { arbeitsMinutenAm, type PruefTag } from "./typen.ts";

/** The two Ausgleichszeiträume of § 6 Abs. 2 Satz 2 ArbZG */
export type NachtZeitraumart = "kalendermonat" | "vier_wochen";

/** The period the business chose; "beide" while it has not chosen (either will do, as in R-03) */
export type NachtAusgleich = NachtZeitraumart | "beide";

/** A period from `von` to `bis`, both days included */
export type NachtZeitraum = { art: NachtZeitraumart; von: Tag; bis: Tag };

/** The default start of the four-week periods, as for the 24 weeks of R-03 (S-202) */
export const NACHT_AUSGLEICH_BEGINN: Tag = "2026-01-01";

export type NachtAusgleichOptionen = {
  /** a period has ended once its last day lies before the Berlin day of `jetzt` */
  jetzt: number;
  /** the place of work: Sundays and its holidays are no Werktage */
  standort: Standort;
  /** days of holiday leave and sickness: taken out of the period with their time, as in R-03 */
  neutral?: ReadonlySet<Tag>;
  /** default "beide" */
  ausgleich?: NachtAusgleich;
  /** first day of the four-week periods; default NACHT_AUSGLEICH_BEGINN */
  beginn?: Tag;
};

/**
 * R-06: the average of a period is over 8 hours per Werktag for a Nachtarbeitnehmer. While the
 * period runs a Hinweis (`ueber` minutes to balance by `zeitraum.bis`), once it ended a Verstoß.
 */
export type NachtAusgleichBefund = Befund<
  "nacht_ausgleich_offen" | "nacht_ausgleich_nicht_erreicht"
> & {
  zeitraum: NachtZeitraum;
  minuten: number;
  hoechstens: number;
  werktage: number;
  ueber: number;
};

/** The period of a kind a day falls in: its calendar month, or four weeks counted from `beginn` */
export const nachtZeitraumAm = (
  tag: Tag,
  art: NachtZeitraumart,
  beginn: Tag,
  grenzen: NachtSonntagGrenzen,
): NachtZeitraum => {
  if (art === "vier_wochen") {
    const laenge = grenzen.vierWochen;
    const von = plusTage(beginn, Math.floor(tageZwischen(beginn, tag) / laenge) * laenge);
    return { art, von, bis: plusTage(von, laenge - 1) };
  }
  const von = tagAus(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)), 1);
  const naechster = tagAus(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)) + 1, 1);
  return { art, von, bis: plusTage(naechster, -1) };
};

export type Gruppe = { zeitraum: NachtZeitraum; tage: PruefTag[] };

/**
 * The periods of one kind that § 6 Abs. 2 ArbZG governs: those with a day on which the person is a
 * Nachtarbeitnehmer in Wechselschicht, or works nights as one (§ 6 Abs. 2 Satz 3: a period without
 * Nachtarbeit of a Nachtarbeitnehmer by days is a matter of § 3 Satz 2 ArbZG, R-03)
 */
export const nachtZeitraeume = (
  tage: readonly PruefTag[],
  nachttage: readonly Nachttag[],
  art: NachtZeitraumart,
  beginn: Tag,
): Gruppe[] => {
  const status = new Map(nachttage.map((eintrag) => [eintrag.tag, eintrag]));
  const gruppen = new Map<Tag, Gruppe & { erfasst: boolean }>();
  for (const tag of tage) {
    const eintrag = status.get(tag.tag);
    const grenzen = nachtSonntagGrenzenAm(tag.tag);
    if (eintrag === undefined || grenzen === null) continue;
    const zeitraum = nachtZeitraumAm(tag.tag, art, beginn, grenzen);
    const gruppe = gruppen.get(zeitraum.von) ?? { zeitraum, tage: [], erfasst: false };
    gruppe.tage.push(tag);
    gruppe.erfasst ||=
      eintrag.nachtarbeitnehmer === "wechselschicht" ||
      (eintrag.nachtarbeit && eintrag.nachtarbeitnehmer !== null);
    gruppen.set(zeitraum.von, gruppe);
  }
  return [...gruppen.values()]
    .filter((gruppe) => gruppe.erfasst)
    .map(({ zeitraum, tage: imZeitraum }) => ({ zeitraum, tage: imZeitraum }));
};

type Bewertung = NachtAusgleichBefund & { beendet: boolean; ueberschritten: boolean };

/** 8 hours per Werktag of the period up to `stand` that is not neutral; null when unknown */
const grenzeBis = (zeitraum: NachtZeitraum, stand: Tag, optionen: NachtAusgleichOptionen) => {
  let hoechstens = 0;
  let werktage = 0;
  for (let tag = zeitraum.von; tag <= stand; tag = plusTage(tag, 1)) {
    const ruhetag = ruhetagAm(tag, optionen.standort);
    const grenzen = nachtSonntagGrenzenAm(tag);
    if (!ruhetag.ok || grenzen === null) return null;
    if (ruhetag.ruhetag !== null || optionen.neutral?.has(tag)) continue;
    hoechstens += grenzen.werktaeglich;
    werktage += 1;
  }
  return { hoechstens, werktage };
};

/** A governed period against its average; null when a day of it has no rule version or holidays */
export const bewerte = (gruppe: Gruppe, optionen: NachtAusgleichOptionen): Bewertung | null => {
  const heute = tagInBerlin(optionen.jetzt);
  const { zeitraum } = gruppe;
  const zaehlen = gruppe.tage.filter((tag) => !optionen.neutral?.has(tag.tag));
  const beendet = zeitraum.bis < heute;
  const zuletzt =
    zaehlen
      .map((tag) => tag.tag)
      .sort()
      .at(-1) ?? zeitraum.von;
  const spaetester = spaeterer(heute, zuletzt);
  const stand = beendet || spaetester > zeitraum.bis ? zeitraum.bis : spaetester;
  const grenze = grenzeBis(zeitraum, stand, optionen);
  if (grenze === null) return null;
  const minuten = zaehlen.reduce((summe, tag) => summe + arbeitsMinutenAm(tag), 0);
  // the days over their share: more than 8 hours on a Werktag, any work on a Sunday or holiday
  const ueberAnteil = zaehlen.filter((tag) => {
    const werktag = ruhetagAm(tag.tag, optionen.standort);
    const anteil =
      werktag.ok && werktag.ruhetag === null
        ? (nachtSonntagGrenzenAm(tag.tag)?.werktaeglich ?? 0)
        : 0;
    return arbeitsMinutenAm(tag) > anteil;
  });
  return {
    regel: "R-06",
    norm: "§ 6 Abs. 2 Satz 2 ArbZG",
    schwere: beendet ? "verstoss" : "hinweis",
    art: beendet ? "nacht_ausgleich_nicht_erreicht" : "nacht_ausgleich_offen",
    tage: ueberAnteil.map((tag) => tag.tag),
    zeitraum,
    minuten,
    ...grenze,
    ueber: minuten - grenze.hoechstens,
    beendet,
    ueberschritten: minuten > grenze.hoechstens,
  };
};

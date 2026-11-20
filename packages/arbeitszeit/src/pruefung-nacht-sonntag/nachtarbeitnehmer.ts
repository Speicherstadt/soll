import type { Befund } from "../befund.ts";
import type { Tag } from "../kalender/tag.ts";
import { nachtSonntagGrenzenAm } from "./grenzen.ts";
import {
  bewerte,
  type Gruppe,
  NACHT_AUSGLEICH_BEGINN,
  type NachtAusgleichBefund,
  type NachtAusgleichOptionen,
  type NachtZeitraumart,
  nachtZeitraeume,
} from "./nacht-ausgleich.ts";
import { type NachtOptionen, type Nachttag, nachttage } from "./nachtzeit.ts";
import { arbeitsMinutenAm, type Pruefergebnis, type PruefTag, sortiert } from "./typen.ts";

export type NachtarbeitnehmerOptionen = NachtOptionen & NachtAusgleichOptionen;

/**
 * R-06, § 2 Abs. 5 Nr. 2 ArbZG: the 40th Nachtarbeitstag of the year (`bald_nachtarbeitnehmer`)
 * and the 48th, from which the person is a Nachtarbeitnehmer (`nachtarbeitnehmer`); `nummer` is
 * the count of the day
 */
export type NachtstatusBefund = Befund<"bald_nachtarbeitnehmer" | "nachtarbeitnehmer"> & {
  nummer: number;
};

/**
 * R-06, § 6 Abs. 2 ArbZG: a Nachtarbeitnehmer's working day over 8 hours (Hinweis, balance within
 * a month or four weeks) or over 10 hours (Verstoß); `ueber` the minutes past the limit crossed
 */
export type NachtTagBefund = Befund<"nacht_ueber_8h" | "nacht_ueber_10h"> & {
  minuten: number;
  ueber: number;
};

export type NachtarbeitnehmerBefund = NachtstatusBefund | NachtTagBefund | NachtAusgleichBefund;

const statusBefunde = (nacht: readonly Nachttag[]): NachtstatusBefund[] =>
  nacht.flatMap((eintrag): NachtstatusBefund[] => {
    const grenzen = nachtSonntagGrenzenAm(eintrag.tag);
    if (grenzen === null || eintrag.nummer === null) return [];
    const bald = eintrag.nummer === grenzen.baldNachtarbeitnehmer && !eintrag.nachtarbeitnehmer;
    const geworden =
      eintrag.nummer === grenzen.nachtarbeitnehmerAb && eintrag.nachtarbeitnehmer === "tage";
    if (!bald && !geworden) return [];
    return [
      {
        regel: "R-06",
        norm: "§ 2 Abs. 5 Nr. 2 ArbZG",
        schwere: "hinweis",
        art: bald ? "bald_nachtarbeitnehmer" : "nachtarbeitnehmer",
        tage: [eintrag.tag],
        nummer: eintrag.nummer,
      },
    ];
  });

/** § 6 Abs. 2 Satz 1 and 2 ArbZG on each day of a governed period the person is a Nachtarbeitnehmer on */
const tagesBefunde = (gruppen: readonly Gruppe[], nacht: readonly Nachttag[]): NachtTagBefund[] => {
  const nachtarbeitnehmer = new Set(
    nacht.filter((eintrag) => eintrag.nachtarbeitnehmer !== null).map((eintrag) => eintrag.tag),
  );
  const tage = new Map(
    gruppen
      .flatMap((gruppe) => gruppe.tage)
      .filter((tag) => nachtarbeitnehmer.has(tag.tag))
      .map((tag) => [tag.tag, tag] as const),
  );
  return [...tage.values()].flatMap((tag): NachtTagBefund[] => {
    const grenzen = nachtSonntagGrenzenAm(tag.tag);
    const minuten = arbeitsMinutenAm(tag);
    if (grenzen === null || minuten <= grenzen.werktaeglich) return [];
    const verstoss = minuten > grenzen.verlaengert;
    return [
      {
        regel: "R-06",
        norm: "§ 6 Abs. 2 ArbZG",
        schwere: verstoss ? "verstoss" : "hinweis",
        art: verstoss ? "nacht_ueber_10h" : "nacht_ueber_8h",
        tage: [tag.tag],
        minuten,
        ueber: minuten - (verstoss ? grenzen.verlaengert : grenzen.werktaeglich),
      },
    ];
  });
};

type Bewertet = NonNullable<ReturnType<typeof bewerte>>;

/** The periods of one kind over their average, and the days of those that cannot be judged */
const bewerteArt = (gruppen: readonly Gruppe[], optionen: NachtAusgleichOptionen) => {
  const bewertungen: Bewertet[] = [];
  const nichtHinterlegt: Tag[] = [];
  for (const gruppe of gruppen) {
    const bewertung = bewerte(gruppe, optionen);
    if (bewertung === null) nichtHinterlegt.push(...gruppe.tage.map((tag) => tag.tag));
    else bewertungen.push(bewertung);
  }
  return { bewertungen, nichtHinterlegt };
};

/**
 * Without a choice either period will do, so a period over the average counts only when one of the
 * other kind is over it too (as in R-03, S-202): a Verstoß once that one has ended as well
 */
const zaehlt = (eigene: Bewertet, andere: readonly Bewertet[] | undefined): boolean => {
  if (andere === undefined) return true;
  const ueber = andere.filter((bewertung) => bewertung.ueberschritten);
  return eigene.beendet ? ueber.some((bewertung) => bewertung.beendet) : ueber.length > 0;
};

const ohneHilfsfelder = ({ beendet: _b, ueberschritten: _u, ...befund }: Bewertet) =>
  befund as NachtAusgleichBefund;

/**
 * §§ 2 and 6 Abs. 2 ArbZG on one person's working days (docs/regeln.md, R-06): when the person
 * becomes a Nachtarbeitnehmer, and for a Nachtarbeitnehmer 8 hours per Werktag with balance within
 * a calendar month or four weeks. Pass the working days from 1 January of the year before.
 */
export const nachtarbeitnehmer = (
  tage: readonly PruefTag[],
  optionen: NachtarbeitnehmerOptionen,
): Pruefergebnis<NachtarbeitnehmerBefund> => {
  const nacht = nachttage(tage, optionen);
  const { ausgleich = "beide", beginn = NACHT_AUSGLEICH_BEGINN } = optionen;
  const arten: NachtZeitraumart[] =
    ausgleich === "beide" ? ["kalendermonat", "vier_wochen"] : [ausgleich];
  const gruppen = arten.map((art) => nachtZeitraeume(tage, nacht.tage, art, beginn));
  const je = gruppen.map((gruppenDerArt) => bewerteArt(gruppenDerArt, optionen));
  const ausgleichBefunde = je.flatMap(({ bewertungen }, index) =>
    bewertungen
      .filter((bewertung) => bewertung.ueberschritten)
      .filter((bewertung) => zaehlt(bewertung, je[1 - index]?.bewertungen))
      .map(ohneHilfsfelder),
  );
  return {
    befunde: [
      ...statusBefunde(nacht.tage),
      ...tagesBefunde(gruppen.flat(), nacht.tage),
      ...ausgleichBefunde,
    ].sort((a, b) => (a.tage[0] ?? "").localeCompare(b.tage[0] ?? "")),
    nichtHinterlegt: sortiert([
      ...nacht.nichtHinterlegt,
      ...je.flatMap((art) => art.nichtHinterlegt),
    ]),
  };
};

import {
  type Abwesenheit,
  type BescheinigungAbTag,
  type BescheinigungsPruefung,
  bescheinigungPruefen,
  type KinderkrankErgebnis,
  kinderkrankZaehlen,
  kindKrankTage,
  type SollGrundlagen,
  type Tag,
  type TagesSoll,
  tageDesZeitraums,
  tagesSoll,
  urlaubsanspruch,
} from "@soll/arbeitszeit";
import type { Db } from "../../../db/oeffnen.ts";
import { betriebLesen } from "../../betrieb/index.ts";
import { arbeitstagVon, sollGrundlagen } from "../grundlagen.ts";
import {
  type AbwesenheitZeile,
  abwesenheitenIn,
  alsZeitraum,
  tageDerAbwesenheiten,
} from "./lesen.ts";

/*
 * What a person's absences add up to (S-401): the leave a request takes, the leave left in the year,
 * the days of Kind krank and where each sickness stands with its certificate (R-27).
 */

/** The Soll of each day of the absences; null when one of them is "nicht hinterlegt" */
export const tageMitSoll = (
  grundlagen: SollGrundlagen,
  tage: readonly Abwesenheit[],
): TagesSoll[] | null => {
  const ergebnis: TagesSoll[] = [];
  for (const tag of [...new Set(tage.map((a) => a.tag))].sort()) {
    const soll = tagesSoll(tag, grundlagen, tage);
    if (!soll.ok) return null;
    ergebnis.push(soll.wert);
  }
  return ergebnis;
};

const halbtageUrlaub = (tage: readonly TagesSoll[]): number =>
  tage.reduce((summe, tag) => summe + tag.urlaubHalbtage, 0);

/**
 * The leave a span takes, in half days: only days with Soll, so neither weekends nor holidays nor
 * days off in the model (§ 3 Abs. 2 BUrlG); null while the Soll of a day is "nicht hinterlegt"
 */
export const urlaubstageVon = (
  grundlagen: SollGrundlagen | null,
  zeile: Pick<AbwesenheitZeile, "art" | "von" | "bis" | "ersterHalb" | "letzterHalb">,
): number | null => {
  if (grundlagen === null) return null;
  if (zeile.art !== "urlaub") return 0;
  const tage = tageMitSoll(
    grundlagen,
    tageDesZeitraums({ ...alsZeitraum(zeile as AbwesenheitZeile), bescheinigung: false }),
  );
  return tage === null ? null : halbtageUrlaub(tage);
};

export type Urlaubsstand = {
  jahr: number;
  /** the leave of the year (R-23, R-25), in half days */
  anspruchHalbtage: number;
  /** approved leave of the year, less days of sickness with a certificate (§ 9 BUrlG) */
  genommenHalbtage: number;
  /** requests not decided yet */
  beantragtHalbtage: number;
  restHalbtage: number;
};

/**
 * The leave of one year: the leave of the year less what was approved and is not sickness with a
 * certificate. Carry-over and expiry come with the accounts in the app (S-402); null while the leave
 * or the Soll of a day is "nicht hinterlegt" (CLAUDE.md, "Never").
 */
export const urlaubsstand = (
  grundlagen: SollGrundlagen | null,
  zeilen: readonly AbwesenheitZeile[],
  jahr: number,
  heute: Tag,
): Urlaubsstand | null => {
  if (grundlagen === null) return null;
  const anspruch = urlaubsanspruch({
    jahr,
    modelle: grundlagen.modelle,
    beschaeftigung: grundlagen.beschaeftigung,
  });
  if (!anspruch.ok) return null;
  const imJahr = (a: Abwesenheit) => a.tag.startsWith(`${jahr}-`);
  const genehmigt = tageMitSoll(grundlagen, tageDerAbwesenheiten(zeilen, heute).filter(imJahr));
  const beantragt = tageMitSoll(
    grundlagen,
    tageDerAbwesenheiten(
      zeilen
        .filter((z) => z.status === "beantragt")
        .map((z) => ({ ...z, status: "genehmigt" as const })),
      heute,
    ).filter(imJahr),
  );
  if (genehmigt === null || beantragt === null) return null;
  const genommenHalbtage = halbtageUrlaub(genehmigt);
  return {
    jahr,
    anspruchHalbtage: anspruch.wert.gesamtHalbtage,
    genommenHalbtage,
    beantragtHalbtage: halbtageUrlaub(beantragt),
    restHalbtage: anspruch.wert.gesamtHalbtage - genommenHalbtage,
  };
};

/**
 * The days of Kind krank of a year per child (R-28, § 45 SGB V): working days only. Whether the
 * person raises the child alone Soll does not know yet (it comes with the data of the employee), so
 * the counter uses the value for two parents.
 */
export const kinderkrankstand = (
  grundlagen: SollGrundlagen | null,
  zeilen: readonly AbwesenheitZeile[],
  jahr: number,
  heute: Tag,
): KinderkrankErgebnis => {
  const tage =
    grundlagen === null
      ? null
      : tageMitSoll(
          grundlagen,
          tageDerAbwesenheiten(
            zeilen.filter((z) => z.art === "kind_krank"),
            heute,
          ).filter((a) => a.tag.startsWith(`${jahr}-`)),
        );
  if (tage === null) return { ok: false, grund: "nicht_hinterlegt" };
  return kinderkrankZaehlen(jahr, kindKrankTage(tage));
};

/** The setting of the business: from which day of a sickness it wants the certificate */
export const bescheinigungAbTagVon = (db: Db, betriebId: string): BescheinigungAbTag =>
  (betriebLesen(db, betriebId)?.bescheinigungAbTag ?? 4) as BescheinigungAbTag;

/** R-27 for a reported sickness of a person (own sickness only: § 5 EntgFG) */
export const bescheinigungVon = (
  db: Db,
  zeile: AbwesenheitZeile,
  heute: Tag,
  grundlagen: SollGrundlagen | null = sollGrundlagen(db, zeile.betriebId, zeile.nutzerId),
): BescheinigungsPruefung | null =>
  zeile.art !== "krank" || zeile.status !== "genehmigt"
    ? null
    : bescheinigungPruefen(
        { von: zeile.von, bis: zeile.bis, bescheinigung: zeile.bescheinigung !== null },
        {
          abTag: bescheinigungAbTagVon(db, zeile.betriebId),
          arbeitstag: arbeitstagVon(grundlagen),
          heute,
        },
      );

/** A reminder to the business: fetch the eAU of a sickness through the payroll program (§ 109 SGB IV) */
export type Erinnerung = {
  abwesenheitId: string;
  nutzerId: string;
  von: Tag;
  faelligAm: Tag;
  ueberfaellig: boolean;
};

/**
 * The sicknesses of a business whose certificate is due today or overdue and not marked as there:
 * the business is reminded to fetch the eAU (R-27). A sickness ended a long while ago stays until
 * its certificate is marked, so nothing is lost.
 */
export const erinnerungenVon = (db: Db, betriebId: string, heute: Tag): Erinnerung[] =>
  abwesenheitenIn(db, betriebId, { von: "0000-01-01", bis: heute, status: ["genehmigt"] })
    .filter((zeile) => zeile.art === "krank" && zeile.bescheinigung === null)
    .flatMap((zeile) => {
      const pruefung = bescheinigungVon(db, zeile, heute);
      if (!pruefung?.eauAbrufen || pruefung.faelligAm === null) return [];
      return [
        {
          abwesenheitId: zeile.abwesenheitId,
          nutzerId: zeile.nutzerId,
          von: zeile.von,
          faelligAm: pruefung.faelligAm,
          ueberfaellig: pruefung.stand === "ueberfaellig",
        },
      ];
    });

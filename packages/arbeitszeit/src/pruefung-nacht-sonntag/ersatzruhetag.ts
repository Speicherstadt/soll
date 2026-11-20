import type { Befund } from "../befund.ts";
import type { Standort } from "../feiertage/laender.ts";
import { plusTage, type Tag } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";
import { nachtSonntagGrenzenAm } from "./grenzen.ts";
import {
  arbeitAnRuhetagen,
  kalendertageMitArbeit,
  type RuhetagMitArbeit,
  ruhetagAm,
} from "./ruhetage.ts";
import { type SonntagsruheOptionen, verschiebungAus } from "./sonntagsruhe.ts";
import { type Pruefergebnis, type PruefTag, sortiert } from "./typen.ts";

export type ErsatzruhetagOptionen = Pick<SonntagsruheOptionen, "standort" | "verschiebung"> & {
  /** a day counts as free once it has passed: before the Berlin day of `jetzt` */
  jetzt: number;
};

/**
 * R-09: a worked Sunday or holiday has no Ersatzruhetag yet while its period runs until `bis`
 * (`ersatzruhetag_offen`, Hinweis), or its period ended without one (`ersatzruhetag_fehlt`,
 * Verstoß). `tage` is the Sunday or holiday; `von` to `bis` are the days the Ersatzruhetag may lie on.
 */
export type ErsatzruhetagBefund = Befund<"ersatzruhetag_offen" | "ersatzruhetag_fehlt"> & {
  von: Tag;
  bis: Tag;
  feiertag: string | null;
};

/** A worked Sunday or holiday with the days its Ersatzruhetag may lie on */
type Bedarf = { ruhetag: RuhetagMitArbeit; von: Tag; bis: Tag; norm: string };

/**
 * § 11 Abs. 3 ArbZG: a period of two weeks for a Sunday (a holiday on a Sunday too), of eight weeks
 * for a holiday on a Werktag, that includes the day: up to 13 or 55 days before or after it
 */
const bedarfAus = (ruhetag: RuhetagMitArbeit): Bedarf | null => {
  const grenzen = nachtSonntagGrenzenAm(ruhetag.tag);
  if (grenzen === null) return null;
  const tage = ruhetag.sonntag ? grenzen.ersatzSonntag : grenzen.ersatzFeiertag;
  return {
    ruhetag,
    von: plusTage(ruhetag.tag, -(tage - 1)),
    bis: plusTage(ruhetag.tag, tage - 1),
    norm: ruhetag.sonntag ? "§ 11 Abs. 3 Satz 1 ArbZG" : "§ 11 Abs. 3 Satz 2 ArbZG",
  };
};

/** The Werktage from `von` to `bis` without any work from 0 to 24 Uhr that have passed */
const freieWerktage = (
  von: Tag,
  bis: Tag,
  heute: Tag,
  mitArbeit: ReadonlySet<Tag>,
  standort: Standort,
): Tag[] => {
  const frei: Tag[] = [];
  for (let tag = von; tag <= bis && tag < heute; tag = plusTage(tag, 1)) {
    const ruhetag = ruhetagAm(tag, standort);
    if (ruhetag.ok && ruhetag.ruhetag === null && !mitArbeit.has(tag)) frei.push(tag);
  }
  return frei;
};

/**
 * Gives each worked Sunday or holiday the earliest free Werktag in its period that no other has,
 * the periods that end first choosing first: no other order leaves fewer without one
 */
const ohneErsatz = (bedarfe: readonly Bedarf[], frei: readonly Tag[]): Bedarf[] => {
  const vergeben = new Set<Tag>();
  const reihenfolge = [...bedarfe].sort(
    (a, b) => a.bis.localeCompare(b.bis) || a.ruhetag.tag.localeCompare(b.ruhetag.tag),
  );
  return reihenfolge.filter((bedarf) => {
    const ersatz = frei.find((tag) => !vergeben.has(tag) && tag >= bedarf.von && tag <= bedarf.bis);
    if (ersatz !== undefined) vergeben.add(ersatz);
    return ersatz === undefined;
  });
};

/**
 * § 11 Abs. 3 ArbZG: every Sunday and holiday with work gets an Ersatzruhetag, a Werktag without
 * work from 0 to 24 Uhr, within two weeks (Sunday) or eight weeks (holiday on a Werktag) that
 * include it (docs/regeln.md, R-09). Pass the working days from 55 days before the first Sunday or
 * holiday to judge, so that its free days before it are known.
 */
export const ersatzruhetag = (
  tage: readonly PruefTag[],
  { standort, verschiebung, jetzt }: ErsatzruhetagOptionen,
): Pruefergebnis<ErsatzruhetagBefund> => {
  const heute = tagInBerlin(jetzt);
  const { ruhetage, nichtHinterlegt } = arbeitAnRuhetagen(tage, standort, (tag) =>
    verschiebungAus(verschiebung, tag),
  );
  const ohne: Tag[] = [...nichtHinterlegt];
  const bedarfe: Bedarf[] = [];
  for (const ruhetag of ruhetage) {
    const bedarf = bedarfAus(ruhetag);
    if (bedarf === null) ohne.push(ruhetag.tag);
    else bedarfe.push(bedarf);
  }
  const von = bedarfe.map((bedarf) => bedarf.von).sort()[0] ?? heute;
  const bis =
    bedarfe
      .map((bedarf) => bedarf.bis)
      .sort()
      .at(-1) ?? heute;
  const frei = freieWerktage(von, bis, heute, kalendertageMitArbeit(tage), standort);
  const befunde = ohneErsatz(bedarfe, frei)
    .map(({ ruhetag, von, bis, norm }): ErsatzruhetagBefund => {
      const fehlt = bis < heute;
      return {
        regel: "R-09",
        norm,
        schwere: fehlt ? "verstoss" : "hinweis",
        art: fehlt ? "ersatzruhetag_fehlt" : "ersatzruhetag_offen",
        tage: [ruhetag.tag],
        von,
        bis,
        feiertag: ruhetag.feiertag?.name ?? null,
      };
    })
    .sort((a, b) => (a.tage[0] ?? "").localeCompare(b.tage[0] ?? ""));
  return { befunde, nichtHinterlegt: sortiert(ohne) };
};

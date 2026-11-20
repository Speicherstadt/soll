import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import type { Tag } from "../kalender/tag.ts";
import type { HoechstarbeitszeitBefund } from "../pruefung/hoechstarbeitszeit.ts";
import type { RuhezeitBefund } from "../pruefung/ruhezeit.ts";
import { sortiert } from "../pruefung/typen.ts";
import type { EinsatzRuhezeitBefund } from "./einsatz.ts";
import { bereitschaftGrenzenAm } from "./grenzen.ts";
import type { BereitschaftsSchicht, BereitschaftsTag } from "./typen.ts";

/**
 * A collective agreement or works agreement under § 7 Abs. 1 Nr. 1 Buchst. a ArbZG that allows more
 * than 10 hours a day when Arbeitsbereitschaft or Bereitschaftsdienst falls into the working time
 * „regelmäßig und in erheblichem Umfang“: a setting of the business with its reference
 * (`fundstelle`). Without it the limit of § 3 ArbZG applies (R-02).
 */
export type Tarif = { fundstelle: string };

/** R-11: more than 10 hours on a day with Bereitschaftsdienst, allowed only by the agreement */
export type TarifBefund = Befund<"ueber_10h_tarif"> & {
  minuten: number;
  ueber: number;
  fundstelle: string;
};

/** R-11, § 7 Abs. 9 ArbZG: after more than 12 hours the rest is shorter than 11 hours */
export type TarifRuhezeitBefund = Befund<"ruhezeit_nach_ueber_12h"> & {
  ruhe: Stueck;
  mindestens: number;
  fehlt: number;
  fundstelle: string;
};

/**
 * The days the agreement covers: those with Bereitschaftsdienst or Arbeitsbereitschaft, the only
 * kinds § 7 Abs. 1 Nr. 1 Buchst. a ArbZG names; a Rufbereitschaft that counts fully is working time
 * but opens no exception (docs/plan.md, Entscheidungen)
 */
const mitBereitschaft = (tage: readonly BereitschaftsTag[]): Map<Tag, BereitschaftsTag> =>
  new Map(tage.filter((tag) => tag.bereitschaftsdienstMinuten > 0).map((tag) => [tag.tag, tag]));

/**
 * R-02 under the agreement: more than 10 hours on a day with Bereitschaftsdienst is a Hinweis of
 * R-11 instead of a Verstoß; a day without Bereitschaftsdienst keeps the Verstoß, the agreement does
 * not cover it
 */
export const mitTarif = (
  befunde: readonly HoechstarbeitszeitBefund[],
  tage: readonly BereitschaftsTag[],
  tarif: Tarif | undefined,
): (HoechstarbeitszeitBefund | TarifBefund)[] => {
  if (tarif === undefined) return [...befunde];
  const bereitschaft = mitBereitschaft(tage);
  return befunde.map((befund) =>
    befund.art === "ueber_10h" && bereitschaft.has(befund.tage[0] as Tag)
      ? {
          regel: "R-11",
          norm: "§ 7 Abs. 1 Nr. 1 Buchst. a ArbZG",
          schwere: "hinweis",
          art: "ueber_10h_tarif",
          tage: befund.tage,
          minuten: befund.minuten,
          ueber: befund.ueber,
          fundstelle: tarif.fundstelle,
        }
      : befund,
  );
};

/** The days the agreement takes past 12 hours: § 7 Abs. 9 ArbZG wants 11 hours of rest after them */
export const ueberZwoelf = (
  tage: readonly BereitschaftsTag[],
  tarif: Tarif | undefined,
): Set<Tag> => {
  if (tarif === undefined) return new Set();
  return new Set(
    [...mitBereitschaft(tage).values()]
      .filter((tag) => {
        // a day no rule version covers is „nicht hinterlegt“, never a day past 12 hours
        const grenzen = bereitschaftGrenzenAm(tag.tag);
        return grenzen !== null && tag.arbeitsMinuten > grenzen.tarifUeber;
      })
      .map((tag) => tag.tag),
  );
};

const MINUTE = 60_000;

/** The rest after the end of a day's work, with the day and the day of the work that ends it */
type RuheNach = { tage: Tag[]; ruhe: Stueck };

/**
 * § 7 Abs. 9 ArbZG: the rest „im unmittelbaren Anschluss an die Beendigung der Arbeitszeit“ of
 * `tag`, from the end of its last shift to the start of the next work of any kind, a call-out of its
 * own included (it ends that rest, R-12). A rest between two shifts of the day lies before that end;
 * none while the day's last shift is open or nothing has followed it yet (as R-05).
 */
const ruheNach = (tag: Tag, schichten: readonly BereitschaftsSchicht[]): RuheNach | null => {
  const ende = schichten.filter((schicht) => schicht.tag === tag).at(-1)?.ende ?? null;
  if (ende === null) return null;
  const naechste = schichten.find((schicht) => schicht.beginn >= ende);
  if (naechste === undefined) return null;
  return {
    tage: sortiert([tag, naechste.tag]),
    ruhe: { beginn: ende, ende: naechste.beginn, minuten: (naechste.beginn - ende) / MINUTE },
  };
};

/** The rests after the days past 12 hours (`ueber12`), in the order of those days */
const ruhenNach = (tage: readonly BereitschaftsTag[], ueber12: ReadonlySet<Tag>): RuheNach[] => {
  const schichten = tage.flatMap((tag) => tag.schichten).sort((a, b) => a.beginn - b.beginn);
  return [...ueber12].flatMap((tag) => ruheNach(tag, schichten) ?? []);
};

/**
 * The beginnings of the rests § 7 Abs. 9 ArbZG keeps from the shortening of § 5 Abs. 2: R-05 gives
 * them no finding of a shortening and no balance, R-11 reports them (`ruheNachTarif`)
 */
export const ohneVerkuerzung = (
  tage: readonly BereitschaftsTag[],
  ueber12: ReadonlySet<Tag>,
): Set<number> => new Set(ruhenNach(tage, ueber12).map(({ ruhe }) => ruhe.beginn));

/**
 * § 7 Abs. 9 ArbZG: the rest after a day of more than 12 hours is at least 11 hours, without the
 * shortening of § 5 Abs. 2. `befunde` are those of R-05 (and R-12), with these rests kept from the
 * shortening (`ohneVerkuerzung`); a rest after such a day under 11 hours is a Verstoß of R-11,
 * unless R-05 or R-12 already reports it as too short even for § 5.
 */
export const ruheNachTarif = (
  befunde: readonly (RuhezeitBefund | EinsatzRuhezeitBefund)[],
  tage: readonly BereitschaftsTag[],
  ueber12: ReadonlySet<Tag>,
  tarif: Tarif | undefined,
): (RuhezeitBefund | EinsatzRuhezeitBefund | TarifRuhezeitBefund)[] => {
  if (tarif === undefined || ueber12.size === 0) return [...befunde];
  const verstossen = new Set(
    befunde.filter((befund) => befund.schwere === "verstoss").map((befund) => befund.ruhe.beginn),
  );
  const neu = ruhenNach(tage, ueber12).flatMap(
    ({ tage: tageDerRuhe, ruhe }): TarifRuhezeitBefund[] => {
      const grenzen = bereitschaftGrenzenAm(tageDerRuhe[0] as Tag);
      if (grenzen === null || ruhe.minuten >= grenzen.tarifRuhezeit || verstossen.has(ruhe.beginn))
        return [];
      return [
        {
          regel: "R-11",
          norm: "§ 7 Abs. 9 ArbZG",
          schwere: "verstoss",
          art: "ruhezeit_nach_ueber_12h",
          tage: tageDerRuhe,
          ruhe,
          mindestens: grenzen.tarifRuhezeit,
          fehlt: grenzen.tarifRuhezeit - ruhe.minuten,
          fundstelle: tarif.fundstelle,
        },
      ];
    },
  );
  return [...befunde, ...neu].sort((a, b) => a.ruhe.beginn - b.ruhe.beginn);
};

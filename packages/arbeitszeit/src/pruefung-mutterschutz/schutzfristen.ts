import type { Befund } from "../befund.ts";
import { plusTage, type Tag } from "../kalender/tag.ts";
import { kalendertageMitArbeit } from "../pruefung-nacht-sonntag/ruhetage.ts";
import { mutterschutzGrenzenAm } from "./grenzen.ts";
import { type Pruefergebnis, type PruefTag, sortiert } from "./typen.ts";

/** The three Schutzfristen of § 3 MuSchG */
export type Schutzfristart = "vor_entbindung" | "nach_entbindung" | "fehlgeburt";

/**
 * A Schutzfrist entered on the employee, both days included. `bereitErklaert`: she has declared
 * herself expressly ready to work (§ 3 Abs. 1 Satz 1, Abs. 5 Satz 1), which only the Schutzfrist
 * before the birth and the one after a Fehlgeburt know. An end moved under § 3 Abs. 4 is entered as
 * `bis`, without reason or certificate (docs/regeln.md, R-21).
 */
export type Schutzfrist = { art: Schutzfristart; von: Tag; bis: Tag; bereitErklaert?: boolean };

/** R-21, § 3 MuSchG: work on the calendar days `tage` of a Schutzfrist */
export type SchutzfristBefund = Befund<"schutzfrist"> & { schutzfrist: Schutzfrist };

const NORM: Record<Schutzfristart, string> = {
  vor_entbindung: "§ 3 Abs. 1 MuSchG",
  nach_entbindung: "§ 3 Abs. 2 MuSchG",
  fehlgeburt: "§ 3 Abs. 5 MuSchG",
};

/**
 * § 3 Abs. 1: the six weeks before the expected day of birth and that day itself; a birth on another
 * day shortens or lengthens it (Satz 4), which the business enters. Null without a rule version.
 */
export const schutzfristVorEntbindung = (voraussichtlich: Tag): Schutzfrist | null => {
  const grenzen = mutterschutzGrenzenAm(voraussichtlich);
  if (grenzen === null) return null;
  const von = plusTage(voraussichtlich, -grenzen.schutzfristVor);
  return { art: "vor_entbindung", von, bis: voraussichtlich };
};

/**
 * § 3 Abs. 2: until the end of eight weeks after the birth (§ 188 Abs. 2 BGB: the same weekday),
 * twelve after a premature or multiple birth or, on request, a disability found (Satz 2), longer by
 * the days the Schutzfrist before the birth fell short (Satz 3)
 */
export const schutzfristNachEntbindung = (
  entbindung: Tag,
  {
    zwoelfWochen = false,
    verlaengerung = 0,
  }: { zwoelfWochen?: boolean; verlaengerung?: number } = {},
): Schutzfrist | null => {
  const grenzen = mutterschutzGrenzenAm(entbindung);
  if (grenzen === null) return null;
  const wochen = zwoelfWochen ? grenzen.schutzfristNachVerlaengert : grenzen.schutzfristNach;
  return {
    art: "nach_entbindung",
    von: plusTage(entbindung, 1),
    bis: plusTage(entbindung, wochen + verlaengerung),
  };
};

/**
 * § 3 Abs. 5 Satz 1: after a Fehlgeburt from the 13th, 17th or 20th week of pregnancy two, six or
 * eight weeks, the day itself included; null before the 13th week. Soll needs the week only for this
 * reckoning and keeps the span, not the week.
 */
export const schutzfristNachFehlgeburt = (
  tag: Tag,
  schwangerschaftswoche: number,
  bereitErklaert = false,
): Schutzfrist | null => {
  const stufe = mutterschutzGrenzenAm(tag)?.fehlgeburt.find(
    (eintrag) => schwangerschaftswoche >= eintrag.abWoche,
  );
  if (stufe === undefined) return null;
  return { art: "fehlgeburt", von: tag, bis: plusTage(tag, stufe.tage), bereitErklaert };
};

/** Whether a declaration lifts the ban: only before the birth and after a Fehlgeburt */
const erlaubt = (schutzfrist: Schutzfrist): boolean =>
  schutzfrist.art !== "nach_entbindung" && schutzfrist.bereitErklaert === true;

/**
 * § 3 MuSchG (docs/regeln.md, R-21): no work on any calendar day of a Schutzfrist into which work
 * falls from 0 to 24 Uhr, unless she has declared herself ready (before the birth, after a
 * Fehlgeburt); after the birth always a Verstoß.
 */
export const schutzfristen = (
  tage: readonly PruefTag[],
  liste: readonly Schutzfrist[],
): Pruefergebnis<SchutzfristBefund> => {
  const mitArbeit = sortiert(kalendertageMitArbeit(tage));
  const nichtHinterlegt = new Set<Tag>();
  const befunde = liste.flatMap((schutzfrist): SchutzfristBefund[] => {
    if (erlaubt(schutzfrist)) return [];
    const darin = mitArbeit.filter((tag) => schutzfrist.von <= tag && tag <= schutzfrist.bis);
    const gepruefte = darin.filter((tag) => {
      const bekannt = mutterschutzGrenzenAm(tag) !== null;
      if (!bekannt) nichtHinterlegt.add(tag);
      return bekannt;
    });
    if (gepruefte.length === 0) return [];
    return [
      {
        regel: "R-21",
        norm: NORM[schutzfrist.art],
        schwere: "verstoss",
        art: "schutzfrist",
        tage: gepruefte,
        schutzfrist,
      },
    ];
  });
  return { befunde, nichtHinterlegt: sortiert(nichtHinterlegt) };
};

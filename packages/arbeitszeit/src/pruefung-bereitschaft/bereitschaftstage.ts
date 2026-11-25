import { zeitpunktGueltig } from "../arbeitstag/arbeitstag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";
import type { PruefTag } from "../pruefung/typen.ts";
import { bereitschaftGrenzenAm } from "./grenzen.ts";
import { aufMinuten } from "./spannen.ts";
import type { BereitschaftEingabe, BereitschaftsTag, Rufdienst, Spanne } from "./typen.ts";
import { bestandAus, tageAus } from "./zusammenfuehren.ts";

export type BereitschaftstageErgebnis =
  | { ok: true; wert: BereitschaftsTag[] }
  | { ok: false; grund: "ungueltig" };

const spanneGueltig = ({ beginn, ende }: Spanne): boolean =>
  zeitpunktGueltig(beginn) && zeitpunktGueltig(ende) && ende > beginn;

const rufdienstGueltig = (dienst: Rufdienst): boolean =>
  spanneGueltig(dienst) &&
  (dienst.reaktionMinuten === undefined ||
    (Number.isSafeInteger(dienst.reaktionMinuten) && dienst.reaktionMinuten >= 0));

/**
 * R-12, EuGH C-518/15 (Matzak): a duty whose reaction time is under the limit counts fully as
 * working time, and so does one without a reaction time (careful default: Soll cannot tell it from a
 * short one) and one on a day no rule version covers
 */
export const zaehltVoll = (dienst: Rufdienst): boolean => {
  const grenzen = bereitschaftGrenzenAm(tagInBerlin(dienst.beginn));
  return (
    dienst.reaktionMinuten === undefined ||
    grenzen === null ||
    dienst.reaktionMinuten < grenzen.reaktionszeitAb
  );
};

/**
 * The working days of one person with Bereitschaft (S-206), in the shape every rule of Phase 2 reads
 * (`PruefTag`), in calendar order. Bereitschaftsdienst and Rufbereitschaft that counts fully are
 * working time (R-11, R-12, Matzak), but only Bereitschaftsdienst is marked for § 7 Abs. 1 Nr. 1
 * Buchst. a ArbZG; already stamped work is not counted twice. A call-out is working
 * time cut into shifts as the same times stamped (R-12, R-29); a block that is only a call-out ends
 * no rest and begins a new one (`ruhezeit`).
 * Rufbereitschaft without a call-out adds nothing. Days of S-206 may come in again.
 */
export const bereitschaftstage = (
  tage: readonly PruefTag[],
  { bereitschaftsdienste = [], rufdienste = [], einsaetze = [] }: BereitschaftEingabe = {},
): BereitschaftstageErgebnis => {
  if (
    ![...bereitschaftsdienste, ...einsaetze].every(spanneGueltig) ||
    !rufdienste.every(rufdienstGueltig)
  )
    return { ok: false, grund: "ungueltig" };
  const bestand = bestandAus(tage);
  const dienste = bereitschaftsdienste.map(aufMinuten);
  const dazu = [...dienste, ...rufdienste.filter(zaehltVoll).map(aufMinuten)];
  return {
    ok: true,
    wert: tageAus({
      ...bestand,
      bereitschaft: [...bestand.bereitschaft, ...dazu],
      bereitschaftsdienst: [...bestand.bereitschaftsdienst, ...dienste],
      einsaetze: [...bestand.einsaetze, ...einsaetze.map(aufMinuten)],
    }),
  };
};

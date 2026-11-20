import type { ArbzgBefund, ArbzgOptionen } from "../pruefung/arbzg.ts";
import { ausgleichszeitraum } from "../pruefung/ausgleichszeitraum.ts";
import { hoechstarbeitszeit } from "../pruefung/hoechstarbeitszeit.ts";
import { ruhepausen } from "../pruefung/ruhepausen.ts";
import { ruhezeit } from "../pruefung/ruhezeit.ts";
import { nachTag, type Pruefergebnis, sortiert } from "../pruefung/typen.ts";
import {
  type EinsatzAusgleichBefund,
  type EinsatzRuhezeitBefund,
  einsatzAusgleich,
  nachEinsatz,
} from "./einsatz.ts";
import { ohne } from "./spannen.ts";
import {
  mitTarif,
  ohneVerkuerzung,
  ruheNachTarif,
  type Tarif,
  type TarifBefund,
  type TarifRuhezeitBefund,
  ueberZwoelf,
} from "./tarif.ts";
import type { BereitschaftsTag } from "./typen.ts";
import { bestandAus, tageAus } from "./zusammenfuehren.ts";

export type BereitschaftBefund =
  | TarifBefund
  | TarifRuhezeitBefund
  | EinsatzRuhezeitBefund
  | EinsatzAusgleichBefund;

/** The options of §§ 3 to 5 ArbZG, and the agreement under § 7 Abs. 1 Nr. 1 Buchst. a (default none) */
export type BereitschaftOptionen = ArbzgOptionen & { tarif?: Tarif };

/** The days without the call-outs that § 5 Abs. 3 ArbZG lets lie in a rest without interrupting it */
const ohneEinsaetze = (
  tage: readonly BereitschaftsTag[],
  frei: ReturnType<typeof einsatzAusgleich>["frei"],
): readonly BereitschaftsTag[] => {
  if (frei.length === 0) return tage;
  const bestand = bestandAus(tage);
  return tageAus({ ...bestand, einsaetze: ohne(bestand.einsaetze, frei) });
};

/**
 * §§ 3 to 5 ArbZG on working days with Bereitschaft (R-02 to R-05 with R-11 and R-12), in calendar
 * order of their first day, and the days no rule version covers. Bereitschaftsdienst is working time
 * in every rule; a call-out ends no rest but begins a new one, and a rest it cuts short is R-12
 * instead of R-05; under § 5 Abs. 3 the call-outs of a rest in hospitals and care are to be balanced
 * instead; with an agreement under § 7 Abs. 1 Nr. 1 Buchst. a a day over 10 hours with
 * Bereitschaftsdienst is a Hinweis of R-11, and the rest after more than 12 hours is 11 hours
 * (§ 7 Abs. 9).
 */
export const bereitschaftBefunde = (
  tage: readonly BereitschaftsTag[],
  optionen: BereitschaftOptionen,
): Pruefergebnis<ArbzgBefund | BereitschaftBefund> => {
  const { tarif, branche = "andere" } = optionen;
  const hoechst = hoechstarbeitszeit(tage);
  const ueber12 = ueberZwoelf(tage, tarif);
  const ausgleich = einsatzAusgleich(tage, branche, ueber12);
  const ruheTage = ohneEinsaetze(tage, ausgleich.frei);
  const ruhe = ruhezeit(ruheTage, {
    ...optionen,
    ohneVerkuerzung: ohneVerkuerzung(ruheTage, ueber12),
  });
  const ergebnisse: Pruefergebnis<ArbzgBefund | BereitschaftBefund>[] = [
    { befunde: mitTarif(hoechst.befunde, tage, tarif), nichtHinterlegt: hoechst.nichtHinterlegt },
    ausgleichszeitraum(tage, optionen),
    ruhepausen(tage),
    {
      befunde: ruheNachTarif(nachEinsatz(ruhe.befunde, ruheTage), ruheTage, ueber12, tarif),
      nichtHinterlegt: ruhe.nichtHinterlegt,
    },
    { befunde: ausgleich.befunde, nichtHinterlegt: [] },
  ];
  return {
    befunde: nachTag(ergebnisse.flatMap((ergebnis) => ergebnis.befunde)),
    nichtHinterlegt: sortiert(ergebnisse.flatMap((ergebnis) => ergebnis.nichtHinterlegt)),
  };
};

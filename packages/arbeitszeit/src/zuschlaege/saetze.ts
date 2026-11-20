import type { Basispunkte, ZuschlagGrenzen } from "./grenzen.ts";
import type { Lage, Tagesart } from "./lage.ts";

/**
 * The surcharges a business pays, in basis points of its hourly wage (2500 = 25 %), set per business
 * or working-time model. They apply to the times of § 3b EStG (docs/plan.md, Entscheidungen,
 * "Zuschläge"). A rate not set is not paid; `nacht0bis4` defaults to `nacht` and `feiertag150` to
 * `feiertag`, since 25.12., 26.12. and 1.5. are legal holidays. 24.12. and 31.12. from 14 Uhr are no
 * holidays and are paid only when set.
 */
export type Zuschlagssaetze = {
  nacht?: Basispunkte;
  nacht0bis4?: Basispunkte;
  sonntag?: Basispunkte;
  feiertag?: Basispunkte;
  feiertag150?: Basispunkte;
  heiligabend?: Basispunkte;
  silvester?: Basispunkte;
};

export const saetzeGueltig = (saetze: Zuschlagssaetze): boolean =>
  Object.values(saetze).every(
    (satz) => satz === undefined || (Number.isSafeInteger(satz) && satz >= 0),
  );

/** Rates of the night and of the day for one stretch, and the kind of day the day rate stands for */
export type Satzpaar = { nacht: Basispunkte; tag: Basispunkte; tagesart: Tagesart | null };

const steuerfreiFuer = (art: Tagesart, grenzen: ZuschlagGrenzen): Basispunkte =>
  ({
    sonntag: grenzen.sonntag,
    feiertag: grenzen.feiertag,
    silvester: grenzen.feiertag,
    feiertag_150: grenzen.feiertag150,
    heiligabend: grenzen.feiertag150,
  })[art];

const gezahltFuer = (art: Tagesart, saetze: Zuschlagssaetze): Basispunkte =>
  ({
    sonntag: saetze.sonntag ?? 0,
    feiertag: saetze.feiertag ?? 0,
    silvester: saetze.silvester ?? 0,
    feiertag_150: saetze.feiertag150 ?? saetze.feiertag ?? 0,
    heiligabend: saetze.heiligabend ?? 0,
  })[art];

/** The kind of day with the highest rate, the first one on a tie */
const hoechste = (
  arten: readonly Tagesart[],
  satz: (art: Tagesart) => Basispunkte,
): { art: Tagesart | null; satz: Basispunkte } =>
  arten.reduce<{ art: Tagesart | null; satz: Basispunkte }>(
    (bisher, art) => (satz(art) > bisher.satz ? { art, satz: satz(art) } : bisher),
    { art: null, satz: 0 },
  );

/**
 * The tax-free rates of a stretch: the night rate plus the highest rate of its kinds of day. The
 * rates add up (R 3b Abs. 3 LStR); Sunday and holiday do not, a Sunday that is a holiday has the
 * holiday rate only (R 3b Abs. 4 LStR).
 */
export const steuerfreieSaetze = (lage: Lage, grenzen: ZuschlagGrenzen): Satzpaar => {
  const tag = hoechste(lage.tagesarten, (art) => steuerfreiFuer(art, grenzen));
  const nacht =
    lage.nacht === "nacht_0_4" ? grenzen.nachtKern : lage.nacht === "nacht" ? grenzen.nacht : 0;
  return { nacht, tag: tag.satz, tagesart: tag.art };
};

/** What the business pays for a stretch: its night rate plus its highest rate of the kinds of day */
export const gezahlteSaetze = (lage: Lage, saetze: Zuschlagssaetze): Satzpaar => {
  const tag = hoechste(lage.tagesarten, (art) => gezahltFuer(art, saetze));
  const nachtSatz = saetze.nacht ?? 0;
  const nacht =
    lage.nacht === "nacht_0_4"
      ? (saetze.nacht0bis4 ?? nachtSatz)
      : lage.nacht === "nacht"
        ? nachtSatz
        : 0;
  return { nacht, tag: tag.satz, tagesart: tag.art };
};

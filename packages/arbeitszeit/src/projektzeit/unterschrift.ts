/*
 * The customer's signature on a Stundennachweis (BAULISTE.md S-605): strokes drawn with a finger,
 * kept as whole-number points on a fixed surface of 600 × 200, whatever the size of the screen. Only
 * the shape is kept: no time, pressure or speed of the strokes, which would make it a biometric
 * signature (Art. 9 DSGVO; docs/plan.md, "Unterschrift des Kunden").
 */

/** The fixed surface and the most a signature may hold */
export const FLAECHE = { breite: 600, hoehe: 200, striche: 100, punkte: 5_000 } as const;

export type Punkt = readonly [number, number];
export type Striche = readonly (readonly Punkt[])[];

const begrenzt = (wert: number, hoechstens: number) => Math.min(hoechstens, Math.max(0, wert));

/** A point on the drawn surface (CSS pixels from its top left) on the fixed surface, rounded */
export const aufFlaeche = (
  punkt: { x: number; y: number },
  gezeichnet: { breite: number; hoehe: number },
): [number, number] => [
  begrenzt(Math.round((punkt.x / gezeichnet.breite) * FLAECHE.breite), FLAECHE.breite),
  begrenzt(Math.round((punkt.y / gezeichnet.hoehe) * FLAECHE.hoehe), FLAECHE.hoehe),
];

const aufDerFlaeche = ([x, y]: Punkt) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  y >= 0 &&
  x <= FLAECHE.breite &&
  y <= FLAECHE.hoehe;

/**
 * Whether strokes make a signature: at most 100 strokes of 5,000 points in all, each point a whole
 * number on the surface, and at least one stroke that is a line (a single tap is no signature)
 */
export const unterschriftPruefen = (striche: Striche): boolean => {
  const punkte = striche.reduce((summe, strich) => summe + strich.length, 0);
  return (
    striche.length > 0 &&
    striche.length <= FLAECHE.striche &&
    punkte <= FLAECHE.punkte &&
    striche.every((strich) => strich.length > 0 && strich.every(aufDerFlaeche)) &&
    striche.some((strich) => strich.length > 1)
  );
};

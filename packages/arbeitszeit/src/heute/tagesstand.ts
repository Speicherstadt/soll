import { type Arbeitstag, arbeitstage, type Stempelbefund } from "../arbeitstag/arbeitstag.ts";
import { LAENGSTE_SCHICHT, type Schicht } from "../arbeitstag/schichten.ts";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import type { Tag } from "../kalender/tag.ts";
import { tagInBerlin } from "../kalender/zeit.ts";
import { type ArbzgGrenzen, arbzgGrenzenAm, type Branche } from "../pruefung/grenzen.ts";
import {
  type HoechstarbeitszeitBefund,
  hoechstarbeitszeit,
} from "../pruefung/hoechstarbeitszeit.ts";
import { type RuhepausenBefund, ruhepausen, tagesPausenabzug } from "../pruefung/ruhepausen.ts";
import { type RuhezeitBefund, ruhezeit } from "../pruefung/ruhezeit.ts";
import { type Ausblick, ausblickBeiArbeit, ruheAusblick } from "./ausblick.ts";

/** Where a person stands: out, working, or on a break */
export type Stempelzustand = "aus" | "arbeit" | "pause";

export type TagesBefund =
  | Stempelbefund
  | HoechstarbeitszeitBefund
  | RuhepausenBefund
  | RuhezeitBefund;

/**
 * A working day as Heute and the times of a day show it (BAULISTE.md S-304): the person's state now,
 * the minutes of the day so far, its findings, and on the running day the next finding ahead.
 */
export type Tagesstand = {
  tag: Tag;
  zustand: Stempelzustand;
  /** while working the Kommen of the shift, on a break its start; null while out */
  seit: number | null;
  /** § 2 Abs. 1 ArbZG; while working counted up to the minute begun now, never less */
  istMinuten: number;
  /** the Ruhepausen taken, and a break running now with its whole minutes */
  pausenMinuten: number;
  /** minutes automatically deducted from closed shifts when the model enables it (docs/regeln.md, R-04) */
  pausenabzugMinuten: number;
  beginn: number | null;
  ende: number | null;
  /** R-01 on the stamps; R-02, R-04 and R-05 as if the person left now */
  befunde: TagesBefund[];
  ausblick: Ausblick | null;
  /** no rule version holds on the day: nothing judged with the limits of another (CLAUDE.md) */
  nichtHinterlegt: boolean;
};

export type TagesstandErgebnis = { ok: true; wert: Tagesstand } | { ok: false; grund: "ungueltig" };

export type TagesstandOptionen = {
  /** the industry of the business for § 5 Abs. 2 ArbZG; default "andere" */
  branche?: Branche;
  /** automatic statutory break deduction on closed shifts from the working-time model; default false */
  pausenabzug?: boolean;
};

export type { Ausblick };

const MINUTE = 60_000;

/** The last shift of the stamps that a stamp can still end: open and less than 24 hours old */
const laufendeSchicht = (tage: readonly Arbeitstag[], jetzt: number): Schicht | null => {
  const letzte = tage.at(-1)?.schichten.at(-1);
  if (letzte === undefined || letzte.offen === null) return null;
  return jetzt - letzte.beginn < LAENGSTE_SCHICHT ? letzte : null;
};

const zustandVon = (schicht: Schicht | null): Stempelzustand => {
  if (schicht?.offen == null) return "aus";
  return schicht.offen.art === "gehen" ? "arbeit" : "pause";
};

/** The working day to show as today: the day of the running shift, else the Berlin day of `jetzt` */
export const aktuellerTag = (stempelungen: readonly Stempelung[], jetzt: number): Tag => {
  const ergebnis = arbeitstage(stempelungen, jetzt);
  const laufend = ergebnis.ok ? laufendeSchicht(ergebnis.wert, jetzt) : null;
  return laufend?.tag ?? tagInBerlin(jetzt);
};

/** The days as if the person stamped Gehen now: what the rules see should the day end here */
const alsObGehen = (stempelungen: readonly Stempelung[], jetzt: number): Arbeitstag[] => {
  const ergebnis = arbeitstage([...stempelungen, { art: "gehen", zeitpunkt: jetzt }], jetzt);
  return ergebnis.ok ? ergebnis.wert : [];
};

const nurAm = <B extends { tage: readonly (Tag | null)[] }>(befunde: readonly B[], tag: Tag): B[] =>
  befunde.filter((befund) => befund.tage.includes(tag));

const regelBefunde = (
  tage: readonly Arbeitstag[],
  tag: Tag,
  jetzt: number,
  optionen: TagesstandOptionen,
): TagesBefund[] =>
  nurAm(
    [
      ...hoechstarbeitszeit(tage).befunde,
      ...ruhepausen(tage).befunde,
      ...ruhezeit(tage, { jetzt, ...optionen }).befunde,
    ],
    tag,
  );

const ausblickFuer = (
  zustand: Stempelzustand,
  schicht: Schicht | undefined,
  tage: readonly Arbeitstag[],
  grenzen: ArbzgGrenzen,
  jetzt: number,
): Ausblick | null => {
  if (zustand === "arbeit" && schicht !== undefined) {
    const amTag = tage.find((tag) => tag.tag === schicht.tag);
    return ausblickBeiArbeit(schicht, amTag?.arbeitsMinuten ?? 0, grenzen, jetzt);
  }
  if (zustand === "aus") return ruheAusblick(tage, grenzen, jetzt);
  return null;
};

/**
 * The state of a day for one person's stamps. `tag` is the working day to show; on the running day
 * (`aktuellerTag`) a shift that runs counts up to now and the next finding is named. A shift whose
 * Gehen is overdue (R-01) is not counted on: its end is not known, and Soll never assumes one.
 */
export const tagesstand = (
  stempelungen: readonly Stempelung[],
  jetzt: number,
  tag: Tag,
  optionen: TagesstandOptionen = {},
): TagesstandErgebnis => {
  const ergebnis = arbeitstage(stempelungen, jetzt);
  if (!ergebnis.ok) return ergebnis;
  const laufend = laufendeSchicht(ergebnis.wert, jetzt);
  const zustand = zustandVon(laufend);
  const imLauf = laufend !== null && laufend.tag === tag;
  const vorschau = imLauf && zustand === "arbeit" && jetzt < (laufend.offen?.faellig ?? 0);
  const tage = vorschau ? alsObGehen(stempelungen, jetzt) : ergebnis.wert;
  const amTag = tage.find((eintrag) => eintrag.tag === tag);
  const echt = ergebnis.wert.find((eintrag) => eintrag.tag === tag);
  const grenzen = arbzgGrenzenAm(tag);
  const laufendePause =
    imLauf && zustand === "pause" && laufend.offen
      ? Math.max(0, Math.floor((jetzt - laufend.offen.seit) / MINUTE))
      : 0;
  const heute = tag === (laufend?.tag ?? tagInBerlin(jetzt));
  const pausenabzugMinuten =
    echt !== undefined ? tagesPausenabzug(echt, optionen.pausenabzug === true) : 0;
  return {
    ok: true,
    wert: {
      tag,
      zustand,
      seit:
        laufend === null
          ? null
          : zustand === "arbeit"
            ? laufend.beginn
            : (laufend.offen?.seit ?? null),
      istMinuten: (amTag?.arbeitsMinuten ?? 0) - pausenabzugMinuten,
      pausenMinuten: (amTag?.pausenMinuten ?? 0) + laufendePause + pausenabzugMinuten,
      pausenabzugMinuten,
      beginn: echt?.beginn ?? null,
      ende: echt?.ende ?? null,
      befunde: [
        ...(echt?.befunde ?? []),
        ...(grenzen === null ? [] : regelBefunde(tage, tag, jetzt, optionen)),
      ],
      ausblick:
        grenzen === null || !heute || (zustand === "arbeit" && !vorschau)
          ? null
          : ausblickFuer(zustand, amTag?.schichten.at(-1), tage, grenzen, jetzt),
      nichtHinterlegt: grenzen === null,
    },
  };
};

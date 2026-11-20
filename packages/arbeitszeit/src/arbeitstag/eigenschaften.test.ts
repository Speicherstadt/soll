import { describe, expect, it } from "vitest";
import { type Arbeitstag, arbeitstage } from "./arbeitstag.ts";
import type { Schicht } from "./schichten.ts";
import { STEMPELARTEN, type Stempelung } from "./stempelungen.ts";

/*
 * Invariants over many small random stamp sequences (fifth review of PR #11). A seeded generator
 * keeps a failure reproducible; the steps sit on the limits the code cuts at: below a minute, 15
 * minutes, 9 hours and 24 hours, around both DST changes and at both ends of 1970 to 2100.
 */
const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;
const KURZ = [0, 1, 10_000, 30_000, 59_999, MINUTE, MINUTE + 1, 5 * MINUTE, 14 * MINUTE];
const LANG = [15 * MINUTE, STUNDE, 9 * STUNDE - 1, 9 * STUNDE, 9 * STUNDE + 1, 16 * STUNDE];
const GRENZEN = [24 * STUNDE - 1, 24 * STUNDE, 24 * STUNDE + 1];
const ANFAENGE = [
  "1970-01-01T00:00:00Z",
  "2026-03-28T20:00:00Z",
  "2026-10-24T20:00:00Z",
  "2099-12-30T00:00:00Z",
].map(Date.parse);

/** A linear congruential generator: the same seed gives the same sequences */
const zufall = (start: number) => {
  let wert = start;
  return () => {
    wert = (wert * 1_103_515_245 + 12_345) & 0x7fffffff;
    return wert / 0x80000000;
  };
};
const waehle = <T>(liste: readonly T[], zahl: number): T =>
  liste[Math.floor(zahl * liste.length)] as T;

const folge = (naechste: () => number): Stempelung[] => {
  let zeit = waehle(ANFAENGE, naechste()) + Math.floor(naechste() * 8 * STUNDE);
  return Array.from({ length: 1 + Math.floor(naechste() * 8) }, () => {
    const art = naechste();
    const schritte = art < 0.6 ? KURZ : art < 0.9 ? LANG : GRENZEN;
    zeit += waehle(schritte, naechste());
    return { art: waehle(STEMPELARTEN, naechste()), zeitpunkt: zeit };
  });
};

const ergebnis = (stempelungen: Stempelung[], jetzt: number): Arbeitstag[] => {
  const tage = arbeitstage(stempelungen, jetzt);
  if (!tage.ok) throw new Error(tage.grund);
  return tage.wert;
};

const gemischt = <T>(liste: readonly T[], naechste: () => number): T[] =>
  liste
    .map((element) => ({ element, rang: naechste() }))
    .sort((a, b) => a.rang - b.rang)
    .map(({ element }) => element);

const ueberschneiden = (teile: readonly { beginn: number; ende: number }[]): boolean =>
  [...teile]
    .sort((a, b) => a.beginn - b.beginn)
    .some((teil, index, alle) => index > 0 && teil.beginn < (alle[index - 1]?.ende ?? 0));

const geschlossen = (schicht: Schicht): schicht is Schicht & { ende: number } =>
  schicht.offen === null && schicht.ende !== null;

describe("invariants of the working day over random stamps", () => {
  const naechste = zufall(20_261_120);
  const faelle = Array.from({ length: 3000 }, () => {
    const stempelungen = folge(naechste);
    const letzte = stempelungen.at(-1)?.zeitpunkt ?? 0;
    const erste = stempelungen[0]?.zeitpunkt ?? 0;
    const jetzt =
      naechste() < 0.5 ? letzte + 48 * STUNDE : erste + Math.floor(naechste() * 30 * STUNDE);
    return { stempelungen, jetzt, gemischt: gemischt(stempelungen, naechste) };
  });

  it("(a) work and Ruhepausen of a closed shift add up to its span in whole minutes", () => {
    for (const { stempelungen, jetzt } of faelle) {
      for (const schicht of ergebnis(stempelungen, jetzt).flatMap((tag) => tag.schichten)) {
        if (!geschlossen(schicht)) continue;
        expect(schicht.arbeitsMinuten + schicht.pausenMinuten, JSON.stringify(stempelungen)).toBe(
          (schicht.ende - schicht.beginn) / MINUTE,
        );
      }
    }
  });

  it("(b) no minute counts twice, within a shift or across shifts", () => {
    for (const { stempelungen, jetzt } of faelle) {
      const schichten = ergebnis(stempelungen, jetzt).flatMap((tag) => tag.schichten);
      const innen = schichten.some((schicht) =>
        ueberschneiden([...schicht.arbeit, ...schicht.pausen]),
      );
      const quer = ueberschneiden(schichten.flatMap((schicht) => schicht.arbeit));
      expect([innen, quer], JSON.stringify(stempelungen)).toEqual([false, false]);
    }
  });

  it("(c) a shift with a missing stamp leaves its day incomplete, and is reported once due", () => {
    for (const { stempelungen, jetzt } of faelle) {
      for (const tag of ergebnis(stempelungen, jetzt)) {
        for (const { offen } of tag.schichten) {
          if (offen === null) continue;
          const art = offen.art === "gehen" ? "gehen_fehlt" : "pause_ende_fehlt";
          const gemeldet = tag.befunde.some(
            (befund) => befund.art === art && befund.zeitpunkt === offen.seit,
          );
          expect([tag.vollstaendig, gemeldet], JSON.stringify(stempelungen)).toEqual([
            false,
            jetzt >= offen.faellig,
          ]);
        }
      }
    }
  });

  it("(d) the order the stamps arrive in does not change the result", () => {
    for (const { stempelungen, jetzt, gemischt: andere } of faelle) {
      expect(ergebnis(andere, jetzt), JSON.stringify(stempelungen)).toEqual(
        ergebnis(stempelungen, jetzt),
      );
    }
  });
});

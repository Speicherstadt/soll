/**
 * Property of the lock of a closed month (S-306): a change `aenderungGesperrt` lets through leaves
 * the records of the closed month as the check page reads them, and a change it refuses would have
 * changed them. Seeded loop over realistic shifts around the boundary of October and November 2026.
 */
import { beginnInBerlin, type Stempelart, type Stempelung } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import type { Db } from "../../db/oeffnen.ts";
import { kanonisch } from "../audit/hash.ts";
import { aenderungGesperrt } from "./abschluss.ts";
import { aufzeichnungen, lesefenster } from "./monatsinhalt.ts";

const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;
const TAG = 24 * STUNDE;
const MONAT = "2026-10";

/** A database that knows only that October is closed: `abgeschlosseneMonate` reads it */
// closed months answer October; the person's call-outs (read in order, S-505) are none
const nurOktoberZu = {
  select: () => ({
    from: () => ({
      where: () => ({ all: () => [{ monat: MONAT }], orderBy: () => ({ all: () => [] }) }),
    }),
  }),
} as unknown as Db;

/** mulberry32: a small seeded generator, so a failing case can be replayed */
const zufall = (saat: number) => {
  let s = saat >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Stempel = Stempelung & { stempelId: string };

/**
 * Shifts from 20 September to 6 November: 2 to 12 hours with a break now and then, apart by 1 to 20
 * hours (so both an interruption under 9 h and time off), on whole minutes; now and then a stray
 * stamp or a missing Gehen
 */
const schichten = (r: () => number): Stempel[] => {
  const stempel: Stempel[] = [];
  const minute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;
  let zeit = beginnInBerlin("2026-09-20") + Math.floor(r() * 20 * STUNDE);
  const ende = beginnInBerlin("2026-11-06");
  const neu = (art: Stempelart, zeitpunkt: number) =>
    stempel.push({ art, zeitpunkt: minute(zeitpunkt), stempelId: `s${stempel.length}` });
  while (zeit < ende) {
    const laenge = 2 * STUNDE + Math.floor(r() * 10 * STUNDE);
    neu("kommen", zeit);
    if (r() < 0.4) {
      const beginn = zeit + Math.floor(laenge / 2);
      neu("pause_beginn", beginn);
      neu("pause_ende", beginn + 30 * MINUTE);
    }
    if (r() > 0.05) neu("gehen", zeit + laenge);
    if (r() < 0.05) neu("gehen", zeit + laenge + Math.floor(r() * 3 * STUNDE));
    zeit += laenge + STUNDE + Math.floor(r() * 19 * STUNDE);
  }
  return stempel;
};

/** The records of October as the check page reads them (`aufzeichnungenJetzt`) */
const pruefseite = (stempel: readonly Stempelung[]) => {
  const { von, bis } = lesefenster(MONAT);
  const imFenster = stempel.filter(({ zeitpunkt }) => zeitpunkt >= von && zeitpunkt < bis);
  return kanonisch(aufzeichnungen(MONAT, imFenster, () => 480));
};

/** The records of October from every stamp there is, all of them inside its window */
const abgeschlossen = (stempel: readonly Stempelung[]) =>
  kanonisch(aufzeichnungen(MONAT, stempel, () => 480));

const ARTEN: Stempelart[] = ["kommen", "gehen", "pause_beginn", "pause_ende"];

/** A change as the API makes it: a stamp added, removed or moved (with its kind) */
const aenderung = (r: () => number, stempel: readonly Stempel[]) => {
  const art = ARTEN[Math.floor(r() * 4)] as Stempelart;
  // mostly around the edges of October, now and then anywhere from late September
  const bereich =
    r() < 0.3
      ? [beginnInBerlin("2026-09-22"), 44 * TAG]
      : r() < 0.5
        ? [beginnInBerlin("2026-09-28"), 5 * TAG]
        : [beginnInBerlin("2026-10-29"), 6 * TAG];
  const [ab = 0, dauer = 0] = bereich;
  const zeitpunkt = Math.floor((ab + r() * dauer) / MINUTE) * MINUTE;
  const weg = stempel[Math.floor(r() * stempel.length)];
  const wahl = r();
  if (wahl < 0.4 || weg === undefined) return { neu: { art, zeitpunkt, stempelId: "neu" } };
  if (wahl < 0.7) return { weg };
  return { weg, neu: { art: r() < 0.5 ? weg.art : art, zeitpunkt, stempelId: "neu" } };
};

/** What `stempelungen.ts` passes in: the stamps in force from `von` to before `bis` */
const gesperrt = (stempel: readonly Stempel[], a: ReturnType<typeof aenderung>) => {
  const zeitpunkte = [a.weg?.zeitpunkt, a.neu?.zeitpunkt].filter(
    (z): z is number => z !== undefined,
  );
  return aenderungGesperrt(nurOktoberZu, "b", "n", {
    zeitpunkte,
    vorher: (von, bis) => stempel.filter(({ zeitpunkt }) => zeitpunkt >= von && zeitpunkt < bis),
    nachher: (vorher) => [
      ...vorher.filter((s) => s.stempelId !== a.weg?.stempelId),
      ...(a.neu ? [a.neu] : []),
    ],
  });
};

const nach = (stempel: readonly Stempel[], a: ReturnType<typeof aenderung>) => [
  ...stempel.filter((s) => s.stempelId !== a.weg?.stempelId),
  ...(a.neu ? [a.neu] : []),
];

describe("aenderungGesperrt", () => {
  it("lets through exactly the changes that leave the closed month's records as closed", () => {
    const fehler: string[] = [];
    for (let saat = 1; saat <= 1000 && fehler.length < 3; saat += 1) {
      const r = zufall(saat);
      const stempel = schichten(r);
      const zu = abgeschlossen(stempel);
      // the check page reads the month as it was closed
      if (pruefseite(stempel) !== zu) fehler.push(`Saat ${saat}: Prüfseite ≠ Abschluss`);
      const a = aenderung(r, stempel);
      const danach = nach(stempel, a);
      const geaendert = pruefseite(danach) !== zu || abgeschlossen(danach) !== zu;
      if (gesperrt(stempel, a) !== geaendert)
        fehler.push(
          `Saat ${saat}: gesperrt ${!geaendert}, ändert ${geaendert}: ${JSON.stringify(a)}`,
        );
    }
    expect(fehler).toEqual([]);
  }, 60_000);
});

describe("aenderungGesperrt with months left out (S-901)", () => {
  const stempel: Stempel[] = [
    { art: "kommen", zeitpunkt: beginnInBerlin("2026-10-06") + 8 * STUNDE, stempelId: "k" },
    { art: "gehen", zeitpunkt: beginnInBerlin("2026-10-06") + 16 * STUNDE, stempelId: "g" },
  ];
  const ohne = (ausser: ReadonlySet<string> = new Set()) =>
    aenderungGesperrt(nurOktoberZu, "b", "n", {
      zeitpunkte: stempel.map(({ zeitpunkt }) => zeitpunkt),
      vorher: () => stempel,
      nachher: () => [],
      ausser,
    });

  it("does not compare a month the removal removes", () => {
    expect(ohne()).toBe(true);
    expect(ohne(new Set([MONAT]))).toBe(false);
    expect(ohne(new Set(["2026-09"]))).toBe(true);
  });
});

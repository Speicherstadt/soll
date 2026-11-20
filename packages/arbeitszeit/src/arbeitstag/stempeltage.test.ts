import { describe, expect, it } from "vitest";
import { tagInBerlin } from "../kalender/zeit.ts";
import { arbeitstage, stempelSchluessel, stempeltage } from "./arbeitstag.ts";
import { schichtgruppen } from "./schichten.ts";
import { durchlaufe, type Lauf, STEMPELARTEN, type Stempelung } from "./stempelungen.ts";
import { gehen, kommen, pause, weiter } from "./testhilfen.ts";

/*
 * The day each stamp is filed under (fourth review of PR #15: R-13 had kept a second rule that
 * disagreed with arbeitstage). A seeded property check over random stamp sequences with breaks,
 * open shifts, unpaired stamps, repeats, night shifts and both DST changes compares `stempeltage`
 * with an oracle that reads the run stamp by stamp and sees what each instant changed.
 */
const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;
const KURZ = [
  0,
  1,
  10_000,
  30_000,
  59_999,
  MINUTE,
  MINUTE + 1,
  5 * MINUTE,
  14 * MINUTE,
  15 * MINUTE,
];
const LANG = [
  STUNDE,
  2 * STUNDE,
  8 * STUNDE,
  9 * STUNDE - 1,
  9 * STUNDE,
  9 * STUNDE + 1,
  16 * STUNDE,
];
const GRENZEN = [23 * STUNDE, 24 * STUNDE - 1, 24 * STUNDE, 24 * STUNDE + 1, 72 * STUNDE];
const ANFAENGE = [
  "1970-01-01T00:00:00Z",
  "2026-03-28T20:00:00Z",
  "2026-10-24T20:00:00Z",
  "2026-11-02T18:00:00Z",
  "2099-12-30T00:00:00Z",
].map(Date.parse);
const SPAETER = [0, STUNDE, 16 * STUNDE, 25 * STUNDE, 30 * 24 * STUNDE];
const RANG = { gehen: 0, pause_beginn: 1, pause_ende: 2, kommen: 3 } as const;

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
  const ganz = naechste() < 0.5;
  const versatz = Math.floor(naechste() * 8 * STUNDE);
  let zeit = waehle(ANFAENGE, naechste()) + (ganz ? versatz - (versatz % MINUTE) : versatz);
  return Array.from({ length: 1 + Math.floor(naechste() * 10) }, () => {
    const art = naechste();
    zeit += waehle(art < 0.55 ? KURZ : art < 0.9 ? LANG : GRENZEN, naechste());
    return { art: waehle(STEMPELARTEN, naechste()), zeitpunkt: zeit };
  });
};

/** The days an instant's stamps went to: what reading them added to or changed in the run */
const orakel = (stempelungen: readonly Stempelung[]): Map<number, Set<string>> => {
  const sortiert = [
    ...new Map(stempelungen.map((s) => [stempelSchluessel(s), s] as const)).values(),
  ].sort((a, b) => a.zeitpunkt - b.zeitpunkt || RANG[a.art] - RANG[b.art]);
  const ganz = durchlaufe(sortiert);
  const tagVon = new Map<number, string>();
  for (const gruppe of schichtgruppen(ganz.stuecke)) {
    const beginn = ganz.stuecke[gruppe[0] as number]?.beginn as number;
    for (const stueck of gruppe) tagVon.set(stueck, tagInBerlin(beginn - (beginn % MINUTE)));
  }
  const tage = new Map<number, Set<string>>();
  const zuletztJeArt = new Map<string, { minute: number; tage: Set<string> }>();
  let vorher: Lauf = durchlaufe([]);
  for (let von = 0; von < sortiert.length; ) {
    const zeit = (sortiert[von] as Stempelung).zeitpunkt;
    let bis = von + 1;
    while (sortiert[bis]?.zeitpunkt === zeit) bis += 1;
    const lauf = durchlaufe(sortiert.slice(0, bis));
    const hier = new Set<string>();
    lauf.stuecke.forEach((stueck, index) => {
      const alt = vorher.stuecke[index];
      if (alt === undefined || alt.ende !== stueck.ende || alt.endetMit !== stueck.endetMit)
        hier.add(tagVon.get(index) as string);
    });
    for (const befund of lauf.befunde.slice(vorher.befunde.length))
      hier.add(
        befund.stueck === null
          ? tagInBerlin(befund.zeitpunkt)
          : (tagVon.get(befund.stueck) as string),
      );
    const minute = Math.floor(zeit / MINUTE);
    // a repeat ignored goes with the stamp it repeats; within an instant of several stamps the
    // oracle cannot tell which one changed nothing, so it allows that day as well
    if (hier.size === 0 || bis - von > 1)
      for (const { art } of sortiert.slice(von, bis)) {
        const frueher = zuletztJeArt.get(art);
        if (frueher?.minute === minute) for (const tag of frueher.tage) hier.add(tag);
      }
    tage.set(zeit, hier);
    for (const { art } of sortiert.slice(von, bis)) zuletztJeArt.set(art, { minute, tage: hier });
    vorher = lauf;
    von = bis;
  }
  return tage;
};

describe("stempeltage: each stamp on the day arbeitstage shows it", () => {
  it("agrees with the run over 4,000 random sequences", () => {
    const fehler: string[] = [];
    for (let seed = 1; seed <= 4_000 && fehler.length < 5; seed++) {
      const naechste = zufall(seed);
      const stempelungen = folge(naechste);
      const jetzt = Math.max(...stempelungen.map((s) => s.zeitpunkt)) + waehle(SPAETER, naechste());
      const ergebnis = arbeitstage(stempelungen, jetzt);
      if (!ergebnis.ok) throw new Error(ergebnis.grund);
      const gezeigt = new Set(ergebnis.wert.map((tag) => tag.tag));
      const erwartet = orakel(stempelungen);
      const gefunden = stempeltage(stempelungen);
      for (const stempel of stempelungen) {
        const tag = gefunden.get(stempelSchluessel(stempel)) ?? "keiner";
        const soll = erwartet.get(stempel.zeitpunkt) ?? new Set();
        if (!soll.has(tag) || !gezeigt.has(tag))
          fehler.push(
            `seed ${seed}: ${stempelungen.map((s) => `${s.art}@${new Date(s.zeitpunkt).toISOString()}`).join(" ")} :: ${stempel.art} ${new Date(stempel.zeitpunkt).toISOString()} → ${tag}, soll ${[...soll]}`,
          );
      }
    }
    expect(fehler).toEqual([]);
  });

  it("files a Pause-Beginn just under 24 h after Kommen with the shift, though its start is cut to the minute", () => {
    const pauseBeginn = pause("2026-11-03T08:00:20+01:00");
    const tage = stempeltage([kommen("2026-11-02T08:00:30+01:00"), pauseBeginn]);
    expect(tage.get(stempelSchluessel(pauseBeginn))).toBe("2026-11-02");
  });

  it("files a double tap with the stamp it repeats, not with the open shift before", () => {
    const zweites = weiter("2026-11-03T07:00:40+01:00");
    const tage = stempeltage([
      kommen("2026-11-02T20:00+01:00"),
      pause("2026-11-02T22:00+01:00"),
      weiter("2026-11-03T07:00:10+01:00"),
      zweites,
    ]);
    expect(tage.get(stempelSchluessel(zweites))).toBe("2026-11-03");
  });

  it("files a Pause-Ende 9 h into a break over midnight on its own day, where its finding is", () => {
    const ende = weiter("2026-11-03T08:00+01:00");
    const stempelungen = [
      kommen("2026-11-02T20:00+01:00"),
      pause("2026-11-02T23:00+01:00"),
      ende,
      gehen("2026-11-03T12:00+01:00"),
    ];
    expect(stempeltage(stempelungen).get(stempelSchluessel(ende))).toBe("2026-11-03");
    const ergebnis = arbeitstage(stempelungen, Date.parse("2026-12-01T00:00Z"));
    const befund = ergebnis.ok
      ? ergebnis.wert.flatMap((tag) => tag.befunde).find((b) => b.zeitpunkt === ende.zeitpunkt)
      : undefined;
    expect(befund?.tage).toEqual(["2026-11-03"]);
  });
});

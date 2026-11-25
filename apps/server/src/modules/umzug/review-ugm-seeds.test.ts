import {
  monatVon,
  plusTage,
  type Stempelung,
  stempelSchluessel,
  stempeltage,
} from "@soll/arbeitszeit";
import type { ImportZeit } from "@soll/import";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { aufzeichnungen, lesefenster } from "../arbeitszeit/monatsinhalt.ts";
import type { Stand } from "./plan-typen.ts";
import { type Genommen, stempelAus, zeitenEinerPerson } from "./plan-zeiten.ts";

/*
 * Review of claude/umzug-geschlossene-monate: the round-5 properties over many seeds, around two
 * month ends (one with the DST change: 31.3.2027 after 28.3.2027), with breaks, and one more:
 * no span taken has its working day in a closed month (the removed shortcut).
 */
const srt = (s: readonly Stempelung[]) => [...s].sort((a, b) => a.zeitpunkt - b.zeitpunkt);
const inhalt = (m: string, s: readonly Stempelung[]) => {
  const { von, bis } = lesefenster(m as never);
  return JSON.stringify(
    aufzeichnungen(
      m as never,
      srt(s).filter((x) => x.zeitpunkt >= von && x.zeitpunkt < bis),
      () => null,
    ).map((t) => [t.tag, t.stempel]),
  );
};
const aendert = (zu: readonly string[], vorher: Stempelung[], neue: readonly Stempelung[]) =>
  zu.some((m) => {
    const { von, bis } = lesefenster(m as never);
    if (!neue.some((n) => n.zeitpunkt >= von && n.zeitpunkt < bis)) return false;
    return inhalt(m, vorher) !== inhalt(m, [...vorher, ...neue]);
  });
const stand = (vorhanden: Stempelung[], zu: string[]): Stand =>
  ({
    jetzt: Date.parse("2027-11-25T12:00:00Z"),
    geschlossen: () => new Set(zu),
    stempelVon: () => srt(vorhanden),
    stempelGesperrt: (_: string, neue: readonly Stempelung[]) => aendert(zu, vorhanden, neue),
  }) as unknown as Stand;

const FAELLE = [
  { start: "2026-09-28", monate: ["2026-09", "2026-10"] },
  { start: "2027-03-27", monate: ["2027-03", "2027-04"] },
];
const span = fc.record({
  tag: fc.integer({ min: 0, max: 4 }),
  beginn: fc.integer({ min: 0, max: 47 }),
  dauer: fc.integer({ min: 1, max: 22 }),
  pause: fc.constantFrom(0, 0, 30),
});
type Sp = { tag: number; beginn: number; dauer: number; pause: number };
const alsZeit = (start: string, s: Sp, i: number): ImportZeit => ({
  externalId: `z${i}`,
  zeile: i,
  person: "p",
  tag: plusTage(start as never, s.tag),
  beginn: s.beginn * 30,
  ende: (s.beginn * 30 + s.dauer * 30) % 1440,
  pauseMinuten: s.pause,
});

const lauf = (fall: (typeof FAELLE)[number], alt: Sp[], neu: Sp[], zu: string[]) => {
  const vorhanden: Stempelung[] = [];
  for (const [i, s] of alt.entries()) {
    const st = stempelAus(alsZeit(fall.start, s, 100 + i));
    if (typeof st === "string") continue;
    const k = (st[0] as Stempelung).zeitpunkt,
      g = (st.at(-1) as Stempelung).zeitpunkt;
    if (vorhanden.some((v) => v.zeitpunkt >= k - 60_000 && v.zeitpunkt <= g + 60_000)) continue;
    if (
      srt(vorhanden).some(
        (v, j, a) => v.art === "kommen" && (a[j + 1]?.zeitpunkt ?? 0) > g && v.zeitpunkt < k,
      )
    )
      continue;
    vorhanden.push(...st);
  }
  const zeiten = neu.map((s, i) => alsZeit(fall.start, s, i));
  const plaene = zeitenEinerPerson(zeiten, "u", stand(vorhanden, zu), new Map() as Genommen);
  return { vorhanden, plaene };
};

describe("closed months over many seeds", () => {
  for (const fall of FAELLE)
    for (let seed = 1; seed <= 15; seed += 1)
      it(`${fall.start} seed ${seed}`, () => {
        fc.assert(
          fc.property(
            fc.array(span, { maxLength: 3 }),
            fc.array(span, { minLength: 1, maxLength: 4 }),
            fc.subarray(fall.monate),
            (alt, neu, zu) => {
              const { vorhanden, plaene } = lauf(fall, alt, neu, zu);
              const genommen = [...plaene.values()].flatMap((p) =>
                typeof p === "string" ? [] : [p],
              );
              const stempel = genommen.flatMap((p) => p.stempel);
              // soundness
              expect(aendert(zu, vorhanden, stempel)).toBe(false);
              // no span taken into a working day of a closed month, by Soll's own day
              const nachher = srt([...vorhanden, ...stempel]);
              const tage = stempeltage(nachher);
              for (const p of genommen) {
                const tag = tage.get(stempelSchluessel(p.stempel[0] as Stempelung));
                expect({ tag, zu }).not.toMatchObject({
                  tag: expect.stringMatching(new RegExp(`^(${zu.join("|") || "x"})`)),
                });
                expect(p.monat).toBe(tag === undefined ? p.monat : monatVon(tag));
              }
              // completeness per refused working day
              const zuMonat = [...plaene.entries()].filter(([, p]) => p === "monat_abgeschlossen");
              const abgelehnt = zuMonat.map(([z]) => stempelAus(z) as Stempelung[]);
              const alleTage = stempeltage(srt([...nachher, ...abgelehnt.flat()]));
              const jeTag = new Map<string, Stempelung[]>();
              for (const s of abgelehnt) {
                const t = alleTage.get(stempelSchluessel(s[0] as Stempelung)) as string;
                jeTag.set(t, [...(jeTag.get(t) ?? []), ...s]);
              }
              for (const [, s] of jeTag) expect(aendert(zu, nachher, s)).toBe(true);
            },
          ),
          { numRuns: 1500, seed: seed * 7919 },
        );
      }, 120_000);
});

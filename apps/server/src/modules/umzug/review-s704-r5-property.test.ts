import { monatVon, type Stempelung, stempelSchluessel, stempeltage } from "@soll/arbeitszeit";
import type { ImportZeit } from "@soll/import";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { aufzeichnungen, lesefenster } from "../arbeitszeit/monatsinhalt.ts";
import type { Stand } from "./plan-typen.ts";
import { type Genommen, zeitenEinerPerson } from "./plan-zeiten.ts";

/*
 * Review S-704, round 5: closed months. Oracle = Soll's own rule (abschluss.ts
 * `aenderungGesperrt`/`stempelDesMonats`): a change is refused iff it alters the records of a
 * closed month read from its window. Soundness: the import never alters a closed month.
 * Completeness: a working day refused as `monat_abgeschlossen` would also be refused if stamped
 * by hand after the import.
 */
const sortiert = (s: readonly Stempelung[]) => [...s].sort((a, b) => a.zeitpunkt - b.zeitpunkt);
const inhalt = (monat: string, s: readonly Stempelung[]) => {
  const { von, bis } = lesefenster(monat as never);
  const im = sortiert(s).filter((x) => x.zeitpunkt >= von && x.zeitpunkt < bis);
  return JSON.stringify(aufzeichnungen(monat as never, im, () => null).map((t) => t.stempel));
};
const aendert = (zu: readonly string[], vorher: Stempelung[], neue: readonly Stempelung[]) =>
  zu.some((m) => {
    const { von, bis } = lesefenster(m as never);
    if (!neue.some((n) => n.zeitpunkt >= von && n.zeitpunkt < bis)) return false;
    return inhalt(m, vorher) !== inhalt(m, [...vorher, ...neue]);
  });

const stand = (vorhanden: Stempelung[], zu: string[]): Stand =>
  ({
    jetzt: Date.parse("2026-11-25T12:00:00Z"),
    geschlossen: () => new Set(zu),
    stempelVon: () => sortiert(vorhanden),
    stempelGesperrt: (_: string, neue: readonly Stempelung[]) => aendert(zu, vorhanden, neue),
  }) as unknown as Stand;

const zeit = (n: number, tag: string, beginn: number, ende: number): ImportZeit => ({
  externalId: `z${n}`,
  zeile: n,
  person: "p",
  tag,
  beginn,
  ende,
  pauseMinuten: 0,
});
const halbe = 30 * 60_000;
const basis = Date.parse("2026-09-29T00:00:00+02:00");
const spanne = fc.tuple(fc.integer({ min: 0, max: 4 * 48 - 1 }), fc.integer({ min: 1, max: 20 }));

const lauf = (alt: [number, number][], neu: [number, number][], zu: string[]) => {
  const vorhanden: Stempelung[] = [];
  let frei = 0;
  for (const [a, l] of [...alt].sort((x, y) => x[0] - y[0])) {
    if (a < frei) continue;
    vorhanden.push(
      { art: "kommen", zeitpunkt: basis + a * halbe },
      { art: "gehen", zeitpunkt: basis + (a + l) * halbe },
    );
    frei = a + l + 1;
  }
  const zeiten = neu.map(([a, l], i) => {
    const tag = `2026-${a < 96 ? "09" : "10"}-${String(a < 96 ? 29 + Math.floor(a / 48) : 1 + Math.floor((a - 96) / 48)).padStart(2, "0")}`;
    const beginn = (a % 48) * 30;
    return zeit(i, tag, beginn, (beginn + l * 30) % 1440);
  });
  const plaene = zeitenEinerPerson(zeiten, "u", stand(vorhanden, zu), new Map() as Genommen);
  const genommen = [...plaene.values()].flatMap((p) => (typeof p === "string" ? [] : p.stempel));
  const zuMonat = [...plaene.entries()].filter(([, p]) => p === "monat_abgeschlossen");
  return { vorhanden, genommen, zuMonat, plaene };
};

const zuArb = fc.subarray(["2026-09", "2026-10"]);

describe("review S-704 r5: closed months decided as Soll decides them", () => {
  it("soundness: the import never alters a closed month", () => {
    fc.assert(
      fc.property(
        fc.array(spanne, { maxLength: 3 }),
        fc.array(spanne, { minLength: 1, maxLength: 4 }),
        zuArb,
        (alt, neu, zu) => {
          const { vorhanden, genommen } = lauf(alt, neu, zu);
          expect(aendert(zu, vorhanden, genommen)).toBe(false);
        },
      ),
      {
        numRuns: 5000,
        examples: [
          [
            [
              [55, 5],
              [96, 1],
              [37, 1],
            ],
            [
              [77, 2],
              [2, 18],
            ],
            ["2026-10"],
          ],
        ],
      },
    );
  }, 60_000);

  it("completeness: a working day refused would be refused by hand after the import too", () => {
    fc.assert(
      fc.property(
        fc.array(spanne, { maxLength: 3 }),
        fc.array(spanne, { minLength: 1, maxLength: 4 }),
        zuArb,
        (alt, neu, zu) => {
          const { vorhanden, genommen, zuMonat } = lauf(alt, neu, zu);
          if (zuMonat.length === 0) return;
          const nachher = [...vorhanden, ...genommen];
          // the refused spans by the working day Soll would give them
          const stempelVon = (z: ImportZeit) => {
            const b = Date.parse(`${z.tag}T00:00:00+02:00`) + z.beginn * 60_000;
            const e =
              Date.parse(`${z.tag}T00:00:00+02:00`) +
              (z.ende > z.beginn ? z.ende : z.ende + 1440) * 60_000;
            return [
              { art: "kommen" as const, zeitpunkt: b },
              { art: "gehen" as const, zeitpunkt: e },
            ];
          };
          const abgelehnt = zuMonat.map(([z]) => stempelVon(z));
          const tage = stempeltage(sortiert([...nachher, ...abgelehnt.flat()]));
          const jeTag = new Map<string, Stempelung[]>();
          for (const s of abgelehnt) {
            const tag = tage.get(stempelSchluessel(s[0] as Stempelung)) as string;
            jeTag.set(tag, [...(jeTag.get(tag) ?? []), ...s]);
          }
          for (const [tag, s] of jeTag)
            expect({
              tag,
              monat: monatVon(tag as never),
              vonHandGesperrt: aendert(zu, nachher, s),
            }).toMatchObject({ vonHandGesperrt: true });
        },
      ),
      {
        numRuns: 5000,
        examples: [
          [
            [[44, 16]],
            [
              [16, 11],
              [77, 19],
            ],
            ["2026-10"],
          ],
        ],
      },
    );
  }, 60_000);
});

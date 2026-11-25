import { monatVon, type Stempelung, stempelSchluessel, stempeltage } from "@soll/arbeitszeit";
import type { ImportZeit } from "@soll/import";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Stand } from "./plan-typen.ts";
import { type Genommen, zeitenEinerPerson } from "./plan-zeiten.ts";

/*
 * Review S-704, round 4. The month a new span is planned into (and checked against as closed,
 * and touched for the old tool's closings) must be the month Soll's month content puts its shift
 * in after the import: `stempeltage` over ALL the person's stamps, the existing ones included
 * (packages/arbeitszeit/src/arbeitstag/arbeitstag.ts; CLAUDE.md: a working day is the day the shift
 * starts; schichten.ts `beginntSchicht`).
 */
const U = "u1";
const stand = (vorhanden: readonly Stempelung[]): Stand =>
  ({
    jetzt: Date.parse("2026-11-25T12:00:00Z"),
    geschlossen: () => new Set(),
    stempelVon: () => vorhanden,
    stempelGesperrt: () => false,
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

/** The month each taken span is planned into, and the month Soll puts its Kommen in afterwards */
const vergleich = (vorhanden: Stempelung[], zeiten: ImportZeit[]) => {
  const plaene = zeitenEinerPerson(zeiten, U, stand(vorhanden), new Map() as Genommen);
  const genommen = [...plaene.values()].flatMap((p) => (typeof p === "string" ? [] : [p]));
  const alle = [...vorhanden, ...genommen.flatMap((p) => p.stempel)].sort(
    (a, b) => a.zeitpunkt - b.zeitpunkt,
  );
  const tage = stempeltage(alle);
  return genommen.map((p) => {
    const kommen = p.stempel[0] as Stempelung;
    const tag = tage.get(stempelSchluessel(kommen));
    return { import: p.monat, soll: tag === undefined ? null : monatVon(tag) };
  });
};

const t = (iso: string) => Date.parse(iso);

describe("review S-704 r4: the import's month of a shift equals Soll's, existing stamps included", () => {
  it("an existing night 30.9. 22:00–1.10. 01:00 and a new span 1.10. 01:30–06:00", () => {
    const vorhanden: Stempelung[] = [
      { art: "kommen", zeitpunkt: t("2026-09-30T22:00:00+02:00") },
      { art: "gehen", zeitpunkt: t("2026-10-01T01:00:00+02:00") },
    ];
    expect(vergleich(vorhanden, [zeit(1, "2026-10-01", 90, 360)])).toEqual([
      { import: "2026-09", soll: "2026-09" },
    ]);
  });

  it("property: random existing and imported spans around the month end", () => {
    const halbe = 30 * 60_000;
    const basis = t("2026-09-29T00:00:00+02:00");
    // spans on a half-hour grid over four days, as [start, length] in half hours
    const spanne = fc.tuple(
      fc.integer({ min: 0, max: 4 * 48 - 1 }),
      fc.integer({ min: 1, max: 20 }),
    );
    fc.assert(
      fc.property(
        fc.array(spanne, { maxLength: 3 }),
        fc.array(spanne, { minLength: 1, maxLength: 4 }),
        (alt, neu) => {
          // existing spans without overlap among themselves
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
          for (const v of vergleich(vorhanden, zeiten)) expect(v.import).toBe(v.soll);
        },
      ),
      { numRuns: 500 },
    );
  });
});

import { monatVon, type Stempelung, stempelSchluessel, stempeltage } from "@soll/arbeitszeit";
import type { ImportZeit } from "@soll/import";
import { describe, expect, it } from "vitest";
import { aufzeichnungen, lesefenster } from "../arbeitszeit/monatsinhalt.ts";
import type { Stand } from "./plan-typen.ts";
import { type Genommen, zeitenEinerPerson } from "./plan-zeiten.ts";

/*
 * Review of claude/umzug-geschlossene-monate. Existing: E 30.9. 14:00 – 1.10. 00:30. October closed.
 * New: N1 30.9. 00:00–05:30, N2 1.10. 01:00–01:30. The working days are cut once with N1 and N2
 * (schichten.ts `beginntSchicht`: with N1 the shift begins 30.9. 00:00, N2 is 25 h later, a shift
 * of 1.10.). N1 is then refused (it would push E's Gehen past 24 h into October). Without N1, N2
 * joins E's shift of 30.9. (CLAUDE.md: a working day is the day the shift starts), but the plan
 * keeps the day it computed with N1: N2 is filed under 1.10., a day of the closed October, and
 * touches October instead of September (`beruehren`, closing of the old tool's months).
 */
const srt = (s: readonly Stempelung[]) => [...s].sort((a, b) => a.zeitpunkt - b.zeitpunkt);
const inhalt = (m: string, s: readonly Stempelung[]) => {
  const { von, bis } = lesefenster(m as never);
  return JSON.stringify(
    aufzeichnungen(
      m as never,
      srt(s).filter((x) => x.zeitpunkt >= von && x.zeitpunkt < bis),
      () => null,
    ).map((t) => t.stempel),
  );
};
// Soll's rule (abschluss.ts `aenderungGesperrt`) over the stamps of `lesefenster`
const vorhanden: Stempelung[] = [
  { art: "kommen", zeitpunkt: Date.parse("2026-09-30T14:00:00+02:00") },
  { art: "gehen", zeitpunkt: Date.parse("2026-10-01T00:30:00+02:00") },
];
const zu = ["2026-10"];
const stand = {
  jetzt: Date.parse("2026-11-25T12:00:00Z"),
  geschlossen: () => new Set(zu),
  stempelVon: () => vorhanden,
  stempelGesperrt: (_: string, neue: readonly Stempelung[]) =>
    zu.some((m) => inhalt(m, vorhanden) !== inhalt(m, [...vorhanden, ...neue])),
} as unknown as Stand;
const zeit = (n: number, tag: string, beginn: number, ende: number): ImportZeit => ({
  externalId: `n${n}`,
  zeile: n,
  person: "p",
  tag,
  beginn,
  ende,
  pauseMinuten: 0,
});

describe("working days after a refused day", () => {
  it("a span taken is filed under the working day Soll gives it after the import", () => {
    const n1 = zeit(1, "2026-09-30", 0, 330);
    const n2 = zeit(2, "2026-10-01", 60, 90);
    const plaene = zeitenEinerPerson([n1, n2], "u", stand, new Map() as Genommen);
    const p2 = plaene.get(n2);
    const genommen = [...plaene.values()].flatMap((p) => (typeof p === "string" ? [] : p.stempel));
    const tage = stempeltage(srt([...vorhanden, ...genommen]));
    const sollTag =
      typeof p2 === "string" || p2 === undefined
        ? null
        : tage.get(stempelSchluessel(p2.stempel[0] as Stempelung));
    expect({
      n1: plaene.get(n1),
      n2: typeof p2 === "string" ? p2 : p2?.monat,
      sollMonat: sollTag ? monatVon(sollTag) : null,
    }).toEqual({ n1: "monat_abgeschlossen", n2: "2026-09", sollMonat: "2026-09" });
  });
});

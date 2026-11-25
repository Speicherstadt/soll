import { describe, expect, it } from "vitest";
import { type LohnmonatEingabe, lohnmonat } from "./lohnmonat.ts";
import { HAMBURG, monatsTage, stundenModell } from "./testdaten.ts";

/*
 * Review S-505, round 4 (R-29, § 3b Abs. 3 Nr. 1 EStG): the round-3 case "Einsatz vor gestempelter
 * Arbeit" across a month boundary. Call-out Tue 30.6.2026 22:00 – 23:50, stamped Wed 1.7. 0:00 – 3:00.
 * Stamped, both are one shift of 30.6. (June) with 40 % from 0 to 3 Uhr. A joined shift belongs to
 * the working day it begins on (CLAUDE.md, "Time"), so June's records hold the call-out and the
 * stamps of 1.7. that join it, and July's records hold neither (apps/server, `aufzeichnungen`).
 */

const S = "+02:00";
const modelle = [stundenModell(2000, { zuschlagssaetze: { nacht: 2500, nacht0bis4: 4000 } })];
const MO_FR = [480, 480, 480, 480, 480, 0, 0];
const t = (iso: string) => Date.parse(`${iso}${S}`);

const monat = (m: string, tage: LohnmonatEingabe["tage"]): LohnmonatEingabe =>
  ({
    nutzerId: "sandra",
    monat: m,
    tage,
    gegeneintraege: [],
    modelle,
    standort: HAMBURG,
  }) as LohnmonatEingabe;

/** cents of all amount items and minutes of all hour items over both months, per kind */
const summe = (...eingaben: LohnmonatEingabe[]) => {
  const jeArt = new Map<string, number>();
  for (const e of eingaben) {
    const r = lohnmonat(e);
    if (!r.ok) throw new Error(JSON.stringify(r.probleme));
    for (const p of r.wert.posten)
      jeArt.set(p.art, (jeArt.get(p.art) ?? 0) + ("cent" in p ? p.cent : p.minuten));
  }
  return Object.fromEntries([...jeArt].sort());
};

describe("review round 4: call-out before midnight on the last day of a month", () => {
  it("June call-out + July stamps pay what the same times stamped pay", () => {
    // stamped: all four stamps belong to the working day 30.6. (CLAUDE.md "Time")
    const juniGestempelt = monatsTage("2026-06", MO_FR, [], S).map((tag) =>
      tag.tag === "2026-06-30"
        ? {
            ...tag,
            stempel: [
              ["kommen", t("2026-06-30T22:00:00")],
              ["gehen", t("2026-06-30T23:50:00")],
              ["kommen", t("2026-07-01T00:00:00")],
              ["gehen", t("2026-07-01T03:00:00")],
            ] as const,
          }
        : tag,
    );
    const juliLeer = monatsTage("2026-07", MO_FR, [], S);

    // with the call-out: June records it and the stamps of 1.7. that join it on 30.6.
    const juniEinsatz = monatsTage("2026-06", MO_FR, [], S).map((tag) =>
      tag.tag === "2026-06-30"
        ? {
            ...tag,
            stempel: [
              ["kommen", t("2026-07-01T00:00:00")],
              ["gehen", t("2026-07-01T03:00:00")],
            ] as const,
            einsaetze: [[t("2026-06-30T22:00:00"), t("2026-06-30T23:50:00")]] as const,
          }
        : tag,
    );

    expect(summe(monat("2026-06", juniEinsatz), monat("2026-07", juliLeer))).toEqual(
      summe(monat("2026-06", juniGestempelt), monat("2026-07", juliLeer)),
    );
  });
});

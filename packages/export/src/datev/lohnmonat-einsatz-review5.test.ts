import { describe, expect, it } from "vitest";
import { type LohnmonatEingabe, lohnmonat } from "./lohnmonat.ts";
import { HAMBURG, monatsTage, stundenModell } from "./testdaten.ts";

/*
 * Review S-505, round 5 (R-29: "nie weniger als dieselben Zeiten gestempelt"; § 3b Abs. 3 Nr. 1
 * EStG). Call-out Wed 3.6.2026 21:00 – 23:00, then stamped Thu 4.6. 2:00 – 4:00 (3 h later).
 * Stamped, the gap is under 9 h (R-01), so it is one shift of 3.6. begun before 0 Uhr: 40 % from
 * 2 to 4 Uhr. With the call-out the stamps are a working day of their own (R-12, 15-min rule) and
 * get 25 %.
 */

const S = "+02:00";
const modelle = [stundenModell(2000, { zuschlagssaetze: { nacht: 2500, nacht0bis4: 4000 } })];
const MO_FR = [480, 480, 480, 480, 480, 0, 0];
const t = (iso: string) => Date.parse(`${iso}${S}`);

const juni = (tage: LohnmonatEingabe["tage"]): LohnmonatEingabe =>
  ({
    nutzerId: "sandra",
    monat: "2026-06",
    tage,
    gegeneintraege: [],
    modelle,
    standort: HAMBURG,
  }) as LohnmonatEingabe;

const summe = (e: LohnmonatEingabe) => {
  const r = lohnmonat(e);
  if (!r.ok) throw new Error(JSON.stringify(r.probleme));
  const jeArt = new Map<string, number>();
  for (const p of r.wert.posten)
    jeArt.set(p.art, (jeArt.get(p.art) ?? 0) + ("cent" in p ? p.cent : p.minuten));
  return Object.fromEntries([...jeArt].sort());
};

describe("review round 5: stamped work 3 h after a call-out begun before midnight", () => {
  it("pays what the same times stamped pay", () => {
    const gestempelt = monatsTage("2026-06", MO_FR, [], S).map((tag) =>
      tag.tag === "2026-06-03"
        ? {
            ...tag,
            stempel: [
              ["kommen", t("2026-06-03T21:00:00")],
              ["gehen", t("2026-06-03T23:00:00")],
              ["kommen", t("2026-06-04T02:00:00")],
              ["gehen", t("2026-06-04T04:00:00")],
            ] as const,
          }
        : tag,
    );
    // as apps/server `aufzeichnungen` files it: the call-out on 3.6., the stamps on 4.6.
    const mitEinsatz = monatsTage("2026-06", MO_FR, [], S).map((tag) =>
      tag.tag === "2026-06-03"
        ? { ...tag, einsaetze: [[t("2026-06-03T21:00:00"), t("2026-06-03T23:00:00")]] as const }
        : tag.tag === "2026-06-04"
          ? {
              ...tag,
              stempel: [
                ["kommen", t("2026-06-04T02:00:00")],
                ["gehen", t("2026-06-04T04:00:00")],
              ] as const,
            }
          : tag,
    );
    expect(summe(juni(mitEinsatz))).toEqual(summe(juni(gestempelt)));
  });
});

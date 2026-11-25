import { describe, expect, it } from "vitest";
import { type LohnmonatEingabe, lohnmonat } from "./lohnmonat.ts";
import { HAMBURG, monatsTage, stundenModell } from "./testdaten.ts";

/*
 * Review S-505, round 3 (R-29): a call-out gets the surcharges and minutes the same times would get
 * stamped, never less; it is a block of the shift it joins (R-12), as `bereitschaftstage` reads it
 */

const S = "+02:00";
const modelle = [stundenModell(2000, { zuschlagssaetze: { nacht: 2500, nacht0bis4: 4000 } })];
const MO_FR = [480, 480, 480, 480, 480, 0, 0];
const posten = (e: LohnmonatEingabe) => {
  const r = lohnmonat(e);
  if (!r.ok) throw new Error(JSON.stringify(r.probleme));
  return r.wert.posten;
};

describe("review round 3: call-out after midnight continuing a shift begun before midnight", () => {
  it("pays the same 40 % from 0 to 4 Uhr as the same times stamped", () => {
    // stamped Wed 3.6. 22:00 – 23:30, call-out Thu 4.6. 0:30 – 2:00 (1 h gap: same shift, R-12)
    const gestempelt = {
      nutzerId: "sandra",
      monat: "2026-06",
      tage: monatsTage(
        "2026-06",
        MO_FR,
        [
          { tag: "2026-06-03", von: "22:00", bis: "23:30" },
          { tag: "2026-06-04", von: "00:30", bis: "02:00" },
        ],
        S,
      ),
      gegeneintraege: [],
      modelle,
      standort: HAMBURG,
    } as LohnmonatEingabe;
    const basis = {
      ...gestempelt,
      tage: monatsTage("2026-06", MO_FR, [{ tag: "2026-06-03", von: "22:00", bis: "23:30" }], S),
    } as LohnmonatEingabe;
    const mitEinsatz = {
      ...basis,
      tage: basis.tage.map((t) =>
        t.tag === "2026-06-03"
          ? {
              ...t,
              einsaetze: [
                [Date.parse(`2026-06-04T00:30:00${S}`), Date.parse(`2026-06-04T02:00:00${S}`)],
              ],
            }
          : t,
      ),
    } as LohnmonatEingabe;
    expect(posten(mitEinsatz)).toEqual(posten(gestempelt));
  });
});

describe("review round 3: call-out before midnight joined to stamped work after midnight", () => {
  it("stamped Thu 4.6. 0:00 – 3:00 after a call-out Wed 22:00 – 23:50 gets 40 % like stamped", () => {
    const eingabe = (schichten: Parameters<typeof monatsTage>[2]) =>
      ({
        nutzerId: "sandra",
        monat: "2026-06",
        tage: monatsTage("2026-06", MO_FR, schichten, S),
        gegeneintraege: [],
        modelle,
        standort: HAMBURG,
      }) as LohnmonatEingabe;
    const gestempelt = eingabe([
      { tag: "2026-06-03", von: "22:00", bis: "23:50" },
      { tag: "2026-06-04", von: "00:00", bis: "03:00" },
    ]);
    const basis = eingabe([{ tag: "2026-06-04", von: "00:00", bis: "03:00" }]);
    const mitEinsatz = {
      ...basis,
      tage: basis.tage.map((t) =>
        t.tag === "2026-06-03"
          ? {
              ...t,
              einsaetze: [
                [Date.parse(`2026-06-03T22:00:00${S}`), Date.parse(`2026-06-03T23:50:00${S}`)],
              ],
            }
          : t,
      ),
    } as LohnmonatEingabe;
    expect(posten(mitEinsatz)).toEqual(posten(gestempelt));
  });
});

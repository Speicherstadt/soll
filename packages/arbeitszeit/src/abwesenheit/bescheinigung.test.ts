import { describe, expect, it } from "vitest";
import { wochentag } from "../kalender/tag.ts";
import { bescheinigungFaellig, bescheinigungPruefen } from "./bescheinigung.ts";

// Monday to Friday; 16 November 2026 is a Monday
const moBisFr = (tag: string) => wochentag(tag) >= 1 && wochentag(tag) <= 5;
const MO = "2026-11-16";
const DI = "2026-11-17";
const MI = "2026-11-18";
const DO = "2026-11-19";
const FR = "2026-11-20";
const SO = "2026-11-22";
const NAECHSTER_MO = "2026-11-23";

const pruefen = (
  krankheit: { von: string; bis: string | null; bescheinigung?: boolean },
  heute: string,
  abTag: 1 | 2 | 3 | 4 = 4,
  arbeitstag = moBisFr,
) => bescheinigungPruefen(krankheit, { abTag, arbeitstag, heute });

// docs/regeln.md, R-27
describe("R-27 Bescheinigung ab dem vierten Tag (§ 5 Abs. 1 EntgFG)", () => {
  it("erlaubt: Mo – Mi (3 Kalendertage), keine Bescheinigung nötig", () => {
    expect(pruefen({ von: MO, bis: MI }, FR)).toEqual({
      faelligAm: null,
      stand: "nicht_noetig",
      eauAbrufen: false,
      befunde: [],
    });
  });

  it("Grenze: Mo – Do (4 Kalendertage), fällig am Do, Erinnerung an die eAU", () => {
    expect(pruefen({ von: MO, bis: DO }, DO)).toEqual({
      faelligAm: DO,
      stand: "heute",
      eauAbrufen: true,
      befunde: [],
    });
  });

  it("Wochenende: Fr – Mo (4 Kalendertage), fällig am Mo, dem nächsten Arbeitstag nach So", () => {
    expect(bescheinigungFaellig({ von: FR, bis: NAECHSTER_MO }, 4, moBisFr)).toBe(NAECHSTER_MO);
    expect(bescheinigungFaellig({ von: FR, bis: SO }, 4, moBisFr)).toBeNull();
  });

  it("Einstellung: Betrieb „ab Tag 1“, krank Mo, fällig am Mo", () => {
    expect(pruefen({ von: MO, bis: MO }, MO, 1)?.faelligAm).toBe(MO);
  });

  it("Einstellung „ab Tag 2“: krank Mo – Di, fällig am Di; nur Mo, keine nötig", () => {
    expect(pruefen({ von: MO, bis: DI }, DI, 2)?.faelligAm).toBe(DI);
    expect(pruefen({ von: MO, bis: MO }, DI, 2)?.stand).toBe("nicht_noetig");
  });

  it("Verstoß: krank Mo – Fr, am Fr noch keine Bescheinigung: Hinweis „fällig seit Do“", () => {
    expect(pruefen({ von: MO, bis: FR }, FR)).toEqual({
      faelligAm: DO,
      stand: "ueberfaellig",
      eauAbrufen: true,
      befunde: [
        {
          regel: "R-27",
          norm: "§ 5 Abs. 1 Satz 2 EntgFG",
          schwere: "hinweis",
          art: "bescheinigung_faellig",
          tage: [DO],
        },
      ],
    });
  });

  it("names Satz 3 when the business asks for it earlier", () => {
    expect(pruefen({ von: MO, bis: FR }, FR, 1)?.befunde[0]?.norm).toBe("§ 5 Abs. 1 Satz 3 EntgFG");
  });

  it("Feiertag am vierten Tag: Christi Himmelfahrt (Do, 14.5.2026), fällig am Fr", () => {
    const arbeitstag = (tag: string) => moBisFr(tag) && tag !== "2026-05-14";
    expect(bescheinigungFaellig({ von: "2026-05-11", bis: null }, 4, arbeitstag)).toBe(
      "2026-05-15",
    );
  });

  it("an open sickness is due later while day 4 has not come, then like any other", () => {
    expect(pruefen({ von: MO, bis: null }, MI)).toMatchObject({
      faelligAm: DO,
      stand: "spaeter",
      eauAbrufen: false,
    });
    expect(pruefen({ von: MO, bis: null }, FR)?.stand).toBe("ueberfaellig");
  });

  it("asks nothing once the certificate is there (eAU or paper)", () => {
    expect(pruefen({ von: MO, bis: FR, bescheinigung: true }, FR)).toEqual({
      faelligAm: DO,
      stand: "liegt_vor",
      eauAbrufen: false,
      befunde: [],
    });
  });

  it("refuses what is no day or no setting", () => {
    expect(pruefen({ von: "2026-13-01", bis: null }, FR)).toBeNull();
    expect(pruefen({ von: MO, bis: null }, FR, 5 as 4)).toBeNull();
  });
});

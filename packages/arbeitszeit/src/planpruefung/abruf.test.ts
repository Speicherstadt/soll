import { describe, expect, it } from "vitest";
import { schicht } from "../dienstplan/testhilfen.ts";
import { type AbrufSchicht, abrufBefunde } from "./abruf.ts";

/** A call for 10:00 to 16:00 on `tag`, told on `mitteilung`; the contract agrees a daily duration */
const abruf = (
  mitteilung: string,
  tag: string,
  von = "10:00",
  bis = "16:00",
  tagesdauer: number | null = 360,
): AbrufSchicht => ({ ...schicht(tag, von, bis), mitteilung, tagesdauer });

const arten = (schichten: AbrufSchicht[]) =>
  abrufBefunde(schichten).befunde.map((b) => [b.art, b.vorlaufTage ?? b.minuten]);

// docs/regeln.md, R-22; Mo 16.11.2026
describe("R-22 Arbeit auf Abruf (§ 12 TzBfG)", () => {
  it("erlaubt: Mo – Mo der Folgewoche", () => {
    expect(arten([abruf("2026-11-16", "2026-11-23")])).toEqual([]);
  });

  it("Grenze: Mo – Sa, vier volle Tage Di bis Fr dazwischen (§ 187 Abs. 1 BGB)", () => {
    expect(arten([abruf("2026-11-16", "2026-11-21")])).toEqual([]);
  });

  it("Verstoß: Mo 10:00 – Fr 10:00, drei volle Tage", () => {
    const [befund] = abrufBefunde([abruf("2026-11-16", "2026-11-20")]).befunde;
    expect(befund).toMatchObject({
      regel: "R-22",
      norm: "§ 12 Abs. 3 Satz 2 TzBfG",
      schwere: "hinweis",
      art: "vorlauf",
      tage: ["2026-11-20"],
      vorlaufTage: 3,
    });
  });

  it("Verstoß: Mo – Do, zwei volle Tage", () => {
    expect(arten([abruf("2026-11-16", "2026-11-19")])).toEqual([["vorlauf", 2]]);
  });

  it("am selben Tag: kein voller Tag dazwischen", () => {
    expect(arten([abruf("2026-11-16", "2026-11-16")])).toEqual([["vorlauf", 0]]);
  });

  it("Dauer: Abruf ohne vereinbarte Tagesdauer für 2:30", () => {
    const kurz = abruf("2026-11-09", "2026-11-23", "10:00", "12:30", null);
    const [befund] = abrufBefunde([kurz]).befunde;
    expect(befund).toMatchObject({ norm: "§ 12 Abs. 1 Satz 4 TzBfG", art: "mindestdauer" });
    expect(befund?.minuten).toBe(150);
  });

  it("Dauer: 3:00 ohne vereinbarte Tagesdauer, und 2:30 mit vereinbarter, sind kein Befund", () => {
    expect(arten([abruf("2026-11-09", "2026-11-23", "10:00", "13:00", null)])).toEqual([]);
    expect(arten([abruf("2026-11-09", "2026-11-23", "10:00", "12:30", 150)])).toEqual([]);
  });

  it("is nicht hinterlegt before the first rule version", () => {
    expect(abrufBefunde([abruf("2025-12-29", "2025-12-30")])).toEqual({
      befunde: [],
      nichtHinterlegt: ["2025-12-30"],
    });
  });
});

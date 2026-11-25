import { describe, expect, it } from "vitest";
import { schicht } from "../dienstplan/testhilfen.ts";
import { tagMit } from "../pruefung/testhilfen.ts";
import { arbeitImPlan, planTage } from "./plantage.ts";

const um = (text: string) => Date.parse(text);

describe("planned shifts as working days (S-502, docs/plan.md 'Pause im Plan')", () => {
  it("puts a Ruhepause in the middle of the working time", () => {
    const geplant = schicht("2026-11-23", "08:00", "17:00", { pauseMinuten: 60 });
    expect(arbeitImPlan(geplant)).toEqual([
      { beginn: um("2026-11-23T08:00+01:00"), ende: um("2026-11-23T12:00+01:00"), minuten: 240 },
      { beginn: um("2026-11-23T13:00+01:00"), ende: um("2026-11-23T17:00+01:00"), minuten: 240 },
    ]);
  });

  it("counts a break under 15 minutes as working time (§ 4 Satz 2 ArbZG)", () => {
    const geplant = schicht("2026-11-23", "08:00", "14:30", { pauseMinuten: 14 });
    const { tage } = planTage([geplant], [], "2026-11-23");
    expect(tage[0]?.schichten[0]).toMatchObject({ arbeitsMinuten: 390, pausen: [] });
  });

  it("gives an odd minute to the second block", () => {
    const geplant = schicht("2026-11-23", "08:00", "14:31", { pauseMinuten: 30 });
    expect(arbeitImPlan(geplant).map((block) => block.minuten)).toEqual([180, 181]);
  });

  it("makes a split shift one shift with a Ruhepause between, of its first day", () => {
    const frueh = schicht("2026-11-23", "10:00", "14:00");
    const spaet = schicht("2026-11-23", "17:00", "22:00");
    const { tage, tagVon } = planTage([spaet, frueh], [], "2026-11-23");
    expect(tage).toHaveLength(1);
    expect(tage[0]?.schichten).toHaveLength(1);
    expect(tage[0]?.schichten[0]).toMatchObject({
      arbeitsMinuten: 540,
      pausen: [expect.objectContaining({ minuten: 180, ruhepause: true })],
    });
    expect(tagVon.get(spaet.schichtId)).toBe("2026-11-23");
  });

  it("begins a new shift after 9 hours off, as S-201 does", () => {
    const abend = schicht("2026-11-23", "14:00", "22:00");
    const morgen = schicht("2026-11-24", "07:00", "12:00");
    const { tage } = planTage([abend, morgen], [], "2026-11-23");
    expect(tage.map((tag) => tag.tag)).toEqual(["2026-11-23", "2026-11-24"]);
  });

  it("joins a shift that starts within 9 hours of the one before into it", () => {
    const abend = schicht("2026-11-23", "14:00", "23:00");
    const morgen = schicht("2026-11-24", "06:00", "12:00");
    const { tage, tagVon } = planTage([abend, morgen], [], "2026-11-23");
    expect(tage.map((tag) => tag.tag)).toEqual(["2026-11-23"]);
    expect(tagVon.get(morgen.schichtId)).toBe("2026-11-23");
  });

  it("counts a person planned twice at once once", () => {
    const eins = schicht("2026-11-23", "08:00", "12:00");
    const zwei = schicht("2026-11-23", "10:00", "14:00");
    const { tage } = planTage([eins, zwei], [], "2026-11-23");
    expect(tage[0]?.schichten[0]?.arbeitsMinuten).toBe(360);
  });

  it("reads days before today from the stamps and the plan from today on", () => {
    const gestern = schicht("2026-11-22", "08:00", "16:00");
    const heute = schicht("2026-11-23", "08:00", "16:00");
    const gestempelt = [tagMit("2026-11-22", 300), tagMit("2026-11-23", 100)];
    const { tage, tagVon } = planTage([gestern, heute], gestempelt, "2026-11-23");
    expect(tage.map((tag) => [tag.tag, tag.schichten[0]?.arbeitsMinuten])).toEqual([
      ["2026-11-22", 300],
      ["2026-11-23", 480],
    ]);
    expect(tagVon.has(gestern.schichtId)).toBe(false);
  });

  it("measures 22:00 to 6:00 in real minutes over the change of clocks, on its first day", () => {
    const herbst = schicht("2026-10-24", "22:00", "06:00");
    const fruehjahr = schicht("2027-03-27", "22:00", "06:00");
    const { tage } = planTage([herbst, fruehjahr], [], "2026-10-01");
    expect(tage.map((tag) => [tag.tag, tag.schichten[0]?.arbeitsMinuten])).toEqual([
      ["2026-10-24", 540],
      ["2027-03-27", 420],
    ]);
  });
});

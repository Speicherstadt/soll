import { describe, expect, it } from "vitest";
import { aufzeichnungen, verbundeneTage } from "./monatsinhalt.ts";

/*
 * Review S-505, round 4 (R-12, R-04, § 2 Abs. 1 ArbZG): call-out Tue 30.6.2026 22:00 – 23:50, stamped
 * Wed 1.7. 0:00 – 3:00. Stamped, it is one shift of 300 min of 30.6. (the 10 min gap is no break).
 * With the call-out the joined shift begins on 30.6. as well: June records the stamps of 1.7. with
 * the call-out and counts 300 min, July records and counts nothing of it, as monatJetzt reads each
 * month from its window.
 */
const ms = (iso: string) => Date.parse(`${iso}+02:00`);
const vollzeit = () => 480;
const stempel = [
  { art: "kommen", zeitpunkt: ms("2026-07-01T00:00:00") },
  { art: "gehen", zeitpunkt: ms("2026-07-01T03:00:00") },
] as const;
const einsaetze = [{ beginn: ms("2026-06-30T22:00:00"), ende: ms("2026-06-30T23:50:00") }];

const istIm = (monat: string) =>
  verbundeneTage(stempel, einsaetze, ms("2026-08-01T00:00:00"))
    .filter((tag) => tag.tag.startsWith(monat))
    .reduce((summe, tag) => summe + tag.arbeitsMinuten, 0);

describe("review round 4: call-out on 30.6. joined to stamped work on 1.7.", () => {
  it("June and July together count 300 min, as the same times stamped, all in June", () => {
    expect(istIm("2026-06")).toBe(300);
    expect(istIm("2026-07")).toBe(0);
  });

  it("June records the stamps of 1.7. on 30.6. with the call-out, July records nothing of them", () => {
    const juni = aufzeichnungen("2026-06", stempel, vollzeit, [], { einsaetze });
    expect(juni.find((tag) => tag.tag === "2026-06-30")).toMatchObject({
      stempel: [
        ["kommen", ms("2026-07-01T00:00:00")],
        ["gehen", ms("2026-07-01T03:00:00")],
      ],
      einsaetze: [[ms("2026-06-30T22:00:00"), ms("2026-06-30T23:50:00")]],
    });
    const juli = aufzeichnungen("2026-07", stempel, vollzeit, [], { einsaetze });
    expect(juli.find((tag) => tag.tag === "2026-07-01")?.stempel).toEqual([]);
  });
});

import { describe, expect, test } from "vitest";
import { zeitstrahlSegmente } from "./zeitstrahlSegmente.ts";

const t = (hm: string) => Date.parse(`2026-11-26T${hm}:00+01:00`);

describe("zeitstrahlSegmente", () => {
  test("splits a shift with a break into work, break, and work segments", () => {
    const segmente = zeitstrahlSegmente(
      [
        { art: "kommen", zeitpunkt: t("08:00") },
        { art: "pause_beginn", zeitpunkt: t("12:00") },
        { art: "pause_ende", zeitpunkt: t("12:30") },
        { art: "gehen", zeitpunkt: t("16:30") },
      ],
      t("18:00"),
    );
    expect(segmente).toEqual([
      { art: "arbeit", beginn: t("08:00"), ende: t("12:00"), minuten: 240 },
      { art: "pause", beginn: t("12:00"), ende: t("12:30"), minuten: 30 },
      { art: "arbeit", beginn: t("12:30"), ende: t("16:30"), minuten: 240 },
    ]);
  });

  test("extends an open shift up to jetzt", () => {
    const segmente = zeitstrahlSegmente([{ art: "kommen", zeitpunkt: t("08:00") }], t("10:15"));
    expect(segmente).toEqual([
      { art: "arbeit", beginn: t("08:00"), ende: t("10:15"), minuten: 135 },
    ]);
  });

  test("returns an empty list when there are no stamps", () => {
    expect(zeitstrahlSegmente([], t("10:00"))).toEqual([]);
  });

  // tdd-review Finding 2: An open shift on a past day (>= 24h old, LAENGSTE_SCHICHT) is overdue
  // (R-01) and must not be extended to `jetzt` days later; Soll never invents a shift end.
  test("does not extend an overdue open shift on a past day up to jetzt", () => {
    const vortag = (hm: string) => Date.parse(`2026-11-20T${hm}:00+01:00`);
    const segmente = zeitstrahlSegmente(
      [
        { art: "kommen", zeitpunkt: vortag("08:00") },
        { art: "pause_beginn", zeitpunkt: vortag("12:00") },
        { art: "pause_ende", zeitpunkt: vortag("12:30") },
      ],
      t("18:00"),
    );
    expect(segmente).toEqual([
      { art: "arbeit", beginn: vortag("08:00"), ende: vortag("12:00"), minuten: 240 },
      { art: "pause", beginn: vortag("12:00"), ende: vortag("12:30"), minuten: 30 },
    ]);
  });

  // tdd-review Finding 3: Per stempelungen.ts, Kommen during a break ends the break (terminals may
  // only offer Kommen/Gehen). zeitstrahlSegmente ignores Kommen when `offen !== null` and turns the
  // entire afternoon into a break segment.
  test("treats Kommen during a break as ending the break and resuming work", () => {
    const segmente = zeitstrahlSegmente(
      [
        { art: "kommen", zeitpunkt: t("08:00") },
        { art: "pause_beginn", zeitpunkt: t("12:00") },
        { art: "kommen", zeitpunkt: t("12:30") },
        { art: "gehen", zeitpunkt: t("16:30") },
      ],
      t("18:00"),
    );
    expect(segmente).toEqual([
      { art: "arbeit", beginn: t("08:00"), ende: t("12:00"), minuten: 240 },
      { art: "pause", beginn: t("12:00"), ende: t("12:30"), minuten: 30 },
      { art: "arbeit", beginn: t("12:30"), ende: t("16:30"), minuten: 240 },
    ]);
  });

  // tdd-review Finding 4: Stamps with the same timestamp must not depend on input order
  // (stempelungen.ts orders simultaneous stamps by what the current state expects).
  test("handles simultaneous Gehen and Kommen regardless of input order", () => {
    const segmente = zeitstrahlSegmente(
      [
        { art: "kommen", zeitpunkt: t("08:00") },
        { art: "kommen", zeitpunkt: t("12:00") },
        { art: "gehen", zeitpunkt: t("12:00") },
        { art: "gehen", zeitpunkt: t("16:00") },
      ],
      t("18:00"),
    );
    expect(segmente).toEqual([
      { art: "arbeit", beginn: t("08:00"), ende: t("12:00"), minuten: 240 },
      { art: "arbeit", beginn: t("12:00"), ende: t("16:00"), minuten: 240 },
    ]);
  });
});

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
});

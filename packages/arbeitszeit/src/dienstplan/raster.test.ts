import { describe, expect, it } from "vitest";
import { wochenRaster } from "./raster.ts";
import { schicht } from "./testhilfen.ts";
import { planWoche } from "./woche.ts";

const { tage } = planWoche("2026-11-23");

describe("wochenRaster", () => {
  it("puts each shift in the row of its person and the column of the day it begins on", () => {
    const frueh = schicht("2026-11-23", "07:00", "15:00");
    const nacht = schicht("2026-11-29", "22:00", "06:00", { nutzerId: "lea" });
    const raster = wochenRaster(tage, ["tom", "lea"], [nacht, frueh]);
    expect(raster.map((zeile) => zeile.nutzerId)).toEqual(["tom", "lea", null]);
    expect(raster[0]?.zellen[0]).toEqual([frueh]);
    // the night from Sunday into Monday stays on Sunday, in this week
    expect(raster[1]?.zellen[6]).toEqual([nacht]);
    expect(raster[1]?.zellen.flat()).toHaveLength(1);
  });

  it("orders the shifts of a day by their beginning and leaves out other weeks", () => {
    const spaet = schicht("2026-11-24", "17:00", "22:00");
    const frueh = schicht("2026-11-24", "06:00", "10:00");
    const naechste = schicht("2026-11-30", "07:00", "15:00");
    const raster = wochenRaster(tage, ["tom"], [spaet, naechste, frueh]);
    expect(raster[0]?.zellen[1]).toEqual([frueh, spaet]);
    expect(raster[0]?.zellen.flat()).toHaveLength(2);
  });

  it("gives open shifts a row of their own and keeps a person no longer listed", () => {
    const offen = schicht("2026-11-26", "14:00", "22:00", { nutzerId: null });
    const frueher = schicht("2026-11-25", "14:00", "22:00", { nutzerId: "yusuf" });
    const raster = wochenRaster(tage, ["tom"], [offen, frueher]);
    expect(raster.map((zeile) => zeile.nutzerId)).toEqual(["tom", "yusuf", null]);
    expect(raster[2]?.zellen[3]).toEqual([offen]);
  });

  it("lays out the week of the change to summer time on its seven days", () => {
    const woche = planWoche("2026-03-29").tage;
    const nacht = schicht("2026-03-28", "22:00", "06:00");
    const sonntag = schicht("2026-03-29", "08:00", "16:00");
    const raster = wochenRaster(woche, ["tom"], [nacht, sonntag]);
    expect(raster[0]?.zellen[5]).toEqual([nacht]);
    expect(raster[0]?.zellen[6]).toEqual([sonntag]);
  });
});

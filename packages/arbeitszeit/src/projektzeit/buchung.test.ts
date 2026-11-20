import { describe, expect, it } from "vitest";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import {
  aufMinute,
  buchungsMinuten,
  buchungZuordnen,
  projektzeitHinweis,
  ueberschneiden,
} from "./buchung.ts";

// 20.11.2026, a Friday in winter time (+01:00)
const um = (zeit: string, tag = "2026-11-20", zone = "+01:00") =>
  Date.parse(`${tag}T${zeit}${zone}`);

describe("aufMinute and buchungsMinuten", () => {
  it("takes an instant to the start of its minute, so minutes are whole", () => {
    expect(aufMinute(um("08:00") + 59_999)).toBe(um("08:00"));
    expect(aufMinute(um("08:00"))).toBe(um("08:00"));
    expect(buchungsMinuten(um("08:00"), um("09:30"))).toBe(90);
  });

  it("counts the real minutes through the night of the change to summer and to winter time", () => {
    // 29.03.2026: 2:00 becomes 3:00, so 1:30 to 3:30 are 60 minutes
    expect(buchungsMinuten(um("01:30", "2026-03-29"), um("03:30", "2026-03-29", "+02:00"))).toBe(
      60,
    );
    // 25.10.2026: 3:00 becomes 2:00, so 1:30 (summer) to 3:30 (winter) are 180 minutes
    expect(
      buchungsMinuten(um("01:30", "2026-10-25", "+02:00"), um("03:30", "2026-10-25", "+01:00")),
    ).toBe(180);
  });

  it("counts a running booking up to now", () => {
    expect(buchungsMinuten(um("08:00"), null, um("08:42") + 30_000)).toBe(42);
  });
});

describe("ueberschneiden", () => {
  const a = { beginn: um("08:00"), ende: um("10:00") };
  it("sees bookings that share a minute, not those that only touch", () => {
    expect(ueberschneiden(a, { beginn: um("09:59"), ende: um("11:00") })).toBe(true);
    expect(ueberschneiden(a, { beginn: um("10:00"), ende: um("11:00") })).toBe(false);
    expect(ueberschneiden(a, { beginn: um("07:00"), ende: um("08:00") })).toBe(false);
    expect(ueberschneiden(a, { beginn: um("07:00"), ende: um("12:00") })).toBe(true);
  });

  it("takes a running booking as open to the end", () => {
    expect(ueberschneiden(a, { beginn: um("09:00"), ende: null })).toBe(true);
    expect(ueberschneiden(a, { beginn: um("10:00"), ende: null })).toBe(false);
    expect(ueberschneiden({ beginn: um("11:00"), ende: null }, a)).toBe(false);
  });
});

describe("buchungZuordnen", () => {
  const stempel = (art: Stempelung["art"], zeitpunkt: number, id: string) => ({
    art,
    zeitpunkt,
    id,
  });

  it("gives the working day of the shift a booking falls in and that shift's Kommen", () => {
    const stempelungen = [
      stempel("kommen", um("07:00"), "k1"),
      stempel("gehen", um("15:30"), "g1"),
    ];
    expect(buchungZuordnen(stempelungen, um("16:00"), um("09:00"))).toEqual({
      tag: "2026-11-20",
      kommen: stempelungen[0],
    });
  });

  it("puts a booking after midnight in a night shift on the day the shift starts", () => {
    const stempelungen = [
      stempel("kommen", um("22:00", "2026-11-19"), "k1"),
      stempel("gehen", um("06:00"), "g1"),
    ];
    expect(buchungZuordnen(stempelungen, um("07:00"), um("02:00"))).toEqual({
      tag: "2026-11-19",
      kommen: stempelungen[0],
    });
  });

  it("follows a shift that still runs", () => {
    const stempelungen = [stempel("kommen", um("07:00"), "k1")];
    expect(buchungZuordnen(stempelungen, um("09:00"), um("08:30")).kommen).toBe(stempelungen[0]);
    // a stopwatch started in the minute of now
    expect(buchungZuordnen(stempelungen, um("09:00"), um("09:00")).kommen).toBe(stempelungen[0]);
  });

  it("names no Kommen outside every shift: the Berlin day of its start", () => {
    const stempelungen = [
      stempel("kommen", um("07:00"), "k1"),
      stempel("gehen", um("12:00"), "g1"),
    ];
    expect(buchungZuordnen(stempelungen, um("20:00"), um("18:00"))).toEqual({
      tag: "2026-11-20",
      kommen: null,
    });
    expect(buchungZuordnen([], um("20:00"), um("00:30", "2026-11-21"))).toEqual({
      tag: "2026-11-21",
      kommen: null,
    });
  });
});

describe("projektzeitHinweis", () => {
  it("is silent while the project time fits into the stamped time", () => {
    expect(projektzeitHinweis({ gebuchtMinuten: 0, gestempeltMinuten: 0 })).toBeNull();
    expect(projektzeitHinweis({ gebuchtMinuten: 480, gestempeltMinuten: 480 })).toBeNull();
    expect(projektzeitHinweis({ gebuchtMinuten: 300, gestempeltMinuten: 480 })).toBeNull();
  });

  it("names booked and stamped minutes and the difference once project time is more", () => {
    expect(projektzeitHinweis({ gebuchtMinuten: 481, gestempeltMinuten: 480 })).toEqual({
      art: "mehr_projektzeit",
      schwere: "hinweis",
      gebuchtMinuten: 481,
      gestempeltMinuten: 480,
      ueberMinuten: 1,
    });
  });

  it("speaks up for project time on a day without any stamp", () => {
    expect(projektzeitHinweis({ gebuchtMinuten: 60, gestempeltMinuten: 0 })).toMatchObject({
      ueberMinuten: 60,
    });
  });
});

import { describe, expect, it } from "vitest";
import type { Stempelung } from "../arbeitstag/stempelungen.ts";
import {
  anteilProzent,
  anwesenheitImMonat,
  auslastungJePerson,
  MINDESTGROESSE,
  monatVorbei,
  type PersonAuslastung,
  teamAuslastung,
} from "./auslastung.ts";

const um = (zeit: string, tag: string, zone = "+01:00") => Date.parse(`${tag}T${zeit}${zone}`);
const s = (art: Stempelung["art"], zeitpunkt: number): Stempelung => ({ art, zeitpunkt });

describe("anwesenheitImMonat", () => {
  it("counts the stamped working time of each working day of the month, breaks not", () => {
    const stempel = [
      s("kommen", um("07:00", "2026-11-19")),
      s("pause_beginn", um("12:00", "2026-11-19")),
      s("pause_ende", um("12:30", "2026-11-19")),
      s("gehen", um("16:00", "2026-11-19")),
      s("kommen", um("08:00", "2026-11-20")),
      s("gehen", um("10:15", "2026-11-20")),
    ];
    expect(anwesenheitImMonat(stempel, um("12:00", "2026-11-25"), "2026-11")).toEqual([
      { tag: "2026-11-19", minuten: 510 },
      { tag: "2026-11-20", minuten: 135 },
    ]);
  });

  it("puts a night shift over the month's end on the day it starts", () => {
    const stempel = [s("kommen", um("22:00", "2026-11-30")), s("gehen", um("06:00", "2026-12-01"))];
    const jetzt = um("12:00", "2026-12-05");
    expect(anwesenheitImMonat(stempel, jetzt, "2026-11")).toEqual([
      { tag: "2026-11-30", minuten: 480 },
    ]);
    expect(anwesenheitImMonat(stempel, jetzt, "2026-12")).toEqual([]);
  });

  it("counts the real minutes of the nights the clocks change", () => {
    // 24.10.2026 22:00 (summer time) to 25.10. 6:00 (winter time): 9 hours
    const herbst = [
      s("kommen", um("22:00", "2026-10-24", "+02:00")),
      s("gehen", um("06:00", "2026-10-25")),
    ];
    expect(anwesenheitImMonat(herbst, um("12:00", "2026-10-30"), "2026-10")).toEqual([
      { tag: "2026-10-24", minuten: 540 },
    ]);
    // 28.3.2026 22:00 (winter time) to 29.3. 6:00 (summer time): 7 hours
    const fruehling = [
      s("kommen", um("22:00", "2026-03-28")),
      s("gehen", um("06:00", "2026-03-29", "+02:00")),
    ];
    expect(anwesenheitImMonat(fruehling, um("12:00", "2026-03-30", "+02:00"), "2026-03")).toEqual([
      { tag: "2026-03-28", minuten: 420 },
    ]);
  });

  it("counts a shift that runs up to now", () => {
    const stempel = [s("kommen", um("07:00", "2026-11-20"))];
    expect(anwesenheitImMonat(stempel, um("09:30", "2026-11-20"), "2026-11")).toEqual([
      { tag: "2026-11-20", minuten: 150 },
    ]);
  });
});

describe("auslastungJePerson", () => {
  const monat = "2026-11";
  const jetzt = um("12:00", "2026-12-02");

  it("splits booked time into billable and internal and keeps presence without a booking", () => {
    const personen = auslastungJePerson({
      monat,
      jetzt,
      anwesenheit: [
        { nutzerId: "sandra", tag: "2026-11-19", minuten: 480 },
        { nutzerId: "sandra", tag: "2026-11-20", minuten: 120 },
      ],
      buchungen: [
        {
          nutzerId: "sandra",
          tag: "2026-11-19",
          beginn: um("07:00", "2026-11-19"),
          ende: um("12:00", "2026-11-19"),
          abrechenbar: true,
        },
        {
          nutzerId: "sandra",
          tag: "2026-11-19",
          beginn: um("12:30", "2026-11-19"),
          ende: um("13:15", "2026-11-19"),
          abrechenbar: false,
        },
      ],
    });
    expect(personen).toEqual([
      {
        nutzerId: "sandra",
        anwesendMinuten: 600,
        abrechenbarMinuten: 300,
        internMinuten: 45,
        ohneBuchungMinuten: 255,
        abrechenbarProzent: 50,
      },
    ]);
  });

  it("leaves out days of other months and counts a booking on the day of its shift", () => {
    const personen = auslastungJePerson({
      monat,
      jetzt,
      anwesenheit: [
        { nutzerId: "max", tag: "2026-10-31", minuten: 480 },
        { nutzerId: "max", tag: "2026-11-30", minuten: 480 },
      ],
      buchungen: [
        // a night shift's booking after midnight belongs to the 30th
        {
          nutzerId: "max",
          tag: "2026-11-30",
          beginn: um("23:00", "2026-11-30"),
          ende: um("02:00", "2026-12-01"),
          abrechenbar: true,
        },
        {
          nutzerId: "max",
          tag: "2026-12-01",
          beginn: um("08:00", "2026-12-01"),
          ende: um("09:00", "2026-12-01"),
          abrechenbar: true,
        },
      ],
    });
    expect(personen).toEqual([
      expect.objectContaining({ anwesendMinuten: 480, abrechenbarMinuten: 180 }),
    ]);
  });

  it("counts the real minutes of a booking through the night of the change to winter time", () => {
    const [person] = auslastungJePerson({
      monat: "2026-10",
      jetzt: um("12:00", "2026-11-02"),
      anwesenheit: [{ nutzerId: "tom", tag: "2026-10-24", minuten: 540 }],
      buchungen: [
        {
          nutzerId: "tom",
          tag: "2026-10-24",
          beginn: um("22:00", "2026-10-24", "+02:00"),
          ende: um("06:00", "2026-10-25"),
          abrechenbar: false,
        },
      ],
    });
    expect(person).toMatchObject({ internMinuten: 540, ohneBuchungMinuten: 0 });
  });

  it("counts a running booking up to now and never less than no time without a booking", () => {
    const [person] = auslastungJePerson({
      monat,
      jetzt: um("10:00", "2026-11-20"),
      anwesenheit: [],
      buchungen: [
        {
          nutzerId: "leon",
          tag: "2026-11-20",
          beginn: um("08:00", "2026-11-20"),
          ende: null,
          abrechenbar: true,
        },
      ],
    });
    expect(person).toEqual({
      nutzerId: "leon",
      anwesendMinuten: 0,
      abrechenbarMinuten: 120,
      internMinuten: 0,
      ohneBuchungMinuten: 0,
      abrechenbarProzent: null,
    });
  });

  it("lists each person once, in a stable order, and nobody without time", () => {
    const personen = auslastungJePerson({
      monat,
      jetzt,
      anwesenheit: [
        { nutzerId: "b", tag: "2026-11-02", minuten: 60 },
        { nutzerId: "a", tag: "2026-11-02", minuten: 60 },
        { nutzerId: "c", tag: "2026-11-02", minuten: 0 },
      ],
      buchungen: [],
    });
    expect(personen.map((p) => p.nutzerId)).toEqual(["a", "b"]);
  });
});

describe("anteilProzent", () => {
  it("gives whole percent, rounded half up, and none without a whole", () => {
    expect(anteilProzent(1, 3)).toBe(33);
    expect(anteilProzent(2, 3)).toBe(67);
    expect(anteilProzent(1, 8)).toBe(13);
    expect(anteilProzent(0, 480)).toBe(0);
    expect(anteilProzent(600, 480)).toBe(125);
    expect(anteilProzent(5, 0)).toBeNull();
  });
});

describe("teamAuslastung", () => {
  const person = (nutzerId: string, anwesend: number, abrechenbar: number, intern: number) =>
    ({
      nutzerId,
      anwesendMinuten: anwesend,
      abrechenbarMinuten: abrechenbar,
      internMinuten: intern,
      ohneBuchungMinuten: Math.max(0, anwesend - abrechenbar - intern),
      abrechenbarProzent: anteilProzent(abrechenbar, anwesend),
    }) satisfies PersonAuslastung;

  it("sums a group of at least the minimum size, without naming anyone", () => {
    const team = teamAuslastung([
      person("a", 480, 300, 60),
      person("b", 480, 480, 60),
      person("c", 0, 30, 0),
    ]);
    expect(team).toEqual({
      art: "team",
      personen: 3,
      anwesendMinuten: 960,
      abrechenbarMinuten: 810,
      internMinuten: 120,
      ohneBuchungMinuten: 120,
      abrechenbarProzent: 84,
    });
    expect(JSON.stringify(team)).not.toContain('"a"');
  });

  it("gives no numbers for a smaller group, only its size and the minimum", () => {
    expect(MINDESTGROESSE).toBe(3);
    expect(teamAuslastung([person("a", 480, 300, 60), person("b", 480, 480, 0)])).toEqual({
      art: "zu_klein",
      personen: 2,
      mindestens: 3,
    });
    expect(teamAuslastung([])).toEqual({ art: "zu_klein", personen: 0, mindestens: 3 });
  });
});

describe("monatVorbei", () => {
  it("is true from the first day after the month's last", () => {
    expect(monatVorbei("2026-10", "2026-11-01")).toBe(true);
    expect(monatVorbei("2026-11", "2026-11-30")).toBe(false);
    expect(monatVorbei("2026-12", "2026-11-20")).toBe(false);
  });
});

import { type Stempelung, zeitpunktInBerlin } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import {
  ALLE_WUENSCHE,
  type Eingabe,
  faelligeErinnerungen,
  type PersonDaten,
  REGELN_VORGABE,
  schluesselVon,
  vormonatVon,
} from "./faellig.ts";

const um = (tag: string, uhrzeit: string) => {
  const [h = 0, m = 0] = uhrzeit.split(":").map(Number);
  return zeitpunktInBerlin(tag, h * 60 + m);
};
const st = (art: Stempelung["art"], tag: string, uhrzeit: string): Stempelung => ({
  art,
  zeitpunkt: um(tag, uhrzeit),
});

const person = (stempelungen: Stempelung[], mehr: Partial<PersonDaten> = {}): PersonDaten => ({
  nutzerId: "lea",
  wuensche: ALLE_WUENSCHE,
  stempelungen,
  vormonat: () => null,
  ...mehr,
});

const lauf = (jetzt: number, personen: PersonDaten[], mehr: Partial<Eingabe> = {}) =>
  faelligeErinnerungen({ jetzt, regeln: REGELN_VORGABE, personen, erinnert: new Set(), ...mehr });

const TAG = "2026-11-18";
const frueh = [st("kommen", TAG, "07:00")];

describe("Ausstempeln vergessen", () => {
  it("is due once the shift has been open for the business's time (10 hours by default)", () => {
    expect(lauf(um(TAG, "16:59"), [person(frueh)]).filter((e) => e.art === "ausstempeln")).toEqual(
      [],
    );
    expect(lauf(um(TAG, "17:00"), [person(frueh)]).filter((e) => e.art === "ausstempeln")).toEqual([
      {
        nutzerId: "lea",
        art: "ausstempeln",
        bezug: String(um(TAG, "07:00")),
        seit: um(TAG, "07:00"),
      },
    ]);
  });

  it("follows the business's time, also during a break", () => {
    const stempel = [...frueh, st("pause_beginn", TAG, "14:00")];
    const regeln = { ...REGELN_VORGABE, gehenMinuten: 8 * 60 };
    expect(lauf(um(TAG, "15:00"), [person(stempel)], { regeln }).map((e) => e.art)).toEqual([
      "ausstempeln",
    ]);
  });

  it("counts real hours across the change to summer time", () => {
    // 29 March 2026: 02:00 becomes 03:00, so 00:00 to 10:00 on the wall clock is nine hours
    const nacht = [st("kommen", "2026-03-29", "00:00")];
    const art = (jetzt: number) => lauf(jetzt, [person(nacht)]).map((e) => e.art);
    expect(art(um("2026-03-29", "10:00"))).not.toContain("ausstempeln");
    expect(art(um("2026-03-29", "11:00"))).toContain("ausstempeln");
  });

  it("is not due for a closed shift, a shift past 24 hours, a reminder already sent or one switched off", () => {
    const zu = [...frueh, st("gehen", TAG, "15:00")];
    expect(lauf(um(TAG, "18:00"), [person(zu)])).toEqual([]);
    expect(lauf(um("2026-11-19", "07:00"), [person(frueh)])).toEqual([]);
    const schon = new Set([
      schluesselVon({ nutzerId: "lea", art: "ausstempeln", bezug: String(um(TAG, "07:00")) }),
    ]);
    expect(lauf(um(TAG, "18:00"), [person(frueh)], { erinnert: schon })).toEqual([]);
    const aus = person(frueh, { wuensche: { ...ALLE_WUENSCHE, ausstempeln: false } });
    expect(lauf(um(TAG, "18:00"), [aus])).toEqual([]);
  });
});

describe("Pause fällig (§ 4 ArbZG)", () => {
  const acht = [st("kommen", TAG, "08:00")];

  it("is due the business's time before six hours of work (15 minutes by default)", () => {
    expect(lauf(um(TAG, "13:44"), [person(acht)])).toEqual([]);
    expect(lauf(um(TAG, "13:45"), [person(acht)])).toEqual([
      {
        nutzerId: "lea",
        art: "pause",
        bezug: `${um(TAG, "08:00")}:0:30`,
        um: um(TAG, "14:00"),
        minuten: 30,
      },
    ]);
  });

  it("names the next break after one was taken: 45 minutes from nine hours on", () => {
    const stempel = [...acht, st("pause_beginn", TAG, "11:00"), st("pause_ende", TAG, "11:30")];
    expect(lauf(um(TAG, "17:14"), [person(stempel)])).toEqual([]);
    expect(lauf(um(TAG, "17:15"), [person(stempel)])).toEqual([
      {
        nutzerId: "lea",
        art: "pause",
        bezug: `${um(TAG, "08:00")}:30:15`,
        um: um(TAG, "17:30"),
        minuten: 15,
      },
    ]);
  });

  it("is not due on a break, after the limit passed or when switched off", () => {
    const pause = [...acht, st("pause_beginn", TAG, "13:40")];
    expect(lauf(um(TAG, "13:50"), [person(pause)])).toEqual([]);
    expect(lauf(um(TAG, "14:05"), [person(acht)])).toEqual([]);
    const aus = person(acht, { wuensche: { ...ALLE_WUENSCHE, pause: false } });
    expect(lauf(um(TAG, "13:50"), [aus])).toEqual([]);
  });

  it("follows the business's lead time", () => {
    const regeln = { ...REGELN_VORGABE, pauseVorlauf: 30 };
    expect(lauf(um(TAG, "13:30"), [person(acht)], { regeln }).map((e) => e.art)).toEqual(["pause"]);
  });
});

describe("Monat bestätigen", () => {
  const offen = { monat: "2026-10", aufgezeichnet: true, bestaetigt: false, abgeschlossen: false };

  it("names the month before the one running in Berlin", () => {
    expect(vormonatVon(um("2026-11-01", "00:00"))).toBe("2026-10");
    expect(vormonatVon(um("2026-10-31", "23:59"))).toBe("2026-09");
    expect(vormonatVon(um("2026-01-01", "09:00"))).toBe("2025-12");
  });

  it("is due from 9:00 on the business's day of the following month, after winter time began", () => {
    const p = person([], { vormonat: () => offen });
    expect(lauf(um("2026-11-01", "08:59"), [p])).toEqual([]);
    expect(lauf(um("2026-11-01", "09:00"), [p])).toEqual([
      { nutzerId: "lea", art: "monat", bezug: "2026-10", monat: "2026-10" },
    ]);
    expect(um("2026-11-01", "09:00")).toBe(Date.UTC(2026, 10, 1, 8));
    const regeln = { ...REGELN_VORGABE, monatTag: 3 };
    expect(lauf(um("2026-11-02", "12:00"), [p], { regeln })).toEqual([]);
    expect(lauf(um("2026-11-03", "09:00"), [p], { regeln })).toHaveLength(1);
  });

  it("is not due for a month without records, confirmed, closed, another month or switched off", () => {
    const jetzt = um("2026-11-05", "10:00");
    for (const vormonat of [
      { ...offen, aufgezeichnet: false },
      { ...offen, bestaetigt: true },
      { ...offen, abgeschlossen: true },
      { ...offen, monat: "2026-09" },
    ]) {
      expect(lauf(jetzt, [person([], { vormonat: () => vormonat })])).toEqual([]);
    }
    const aus = person([], { vormonat: () => offen, wuensche: { ...ALLE_WUENSCHE, monat: false } });
    expect(lauf(jetzt, [aus])).toEqual([]);
  });

  it("does not read the month before 9:00 on the day or once the reminder went out", () => {
    let gelesen = 0;
    const p = person([], {
      vormonat: () => {
        gelesen += 1;
        return offen;
      },
    });
    lauf(um("2026-11-01", "08:59"), [p]);
    const schon = new Set([schluesselVon({ nutzerId: "lea", art: "monat", bezug: "2026-10" })]);
    lauf(um("2026-11-01", "09:00"), [p], { erinnert: schon });
    expect(gelesen).toBe(0);
  });
});

describe("several people", () => {
  it("decides for each person on their own", () => {
    const jetzt = um(TAG, "17:00");
    const ergebnis = lauf(jetzt, [person(frueh), person([], { nutzerId: "tom" })]);
    expect(ergebnis.map((e) => e.nutzerId)).toEqual(["lea"]);
  });
});

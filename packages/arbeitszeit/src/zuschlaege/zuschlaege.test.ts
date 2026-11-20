import { describe, expect, it } from "vitest";
import {
  BRANDENBURG,
  einTag,
  HAMBURG,
  rechne,
  saetzeVon,
  schicht,
  stundenlohn,
} from "./testhilfen.ts";
import { zuschlaege } from "./zuschlaege.ts";

/*
 * docs/regeln.md, R-29, taken literally: Grundlohn 20 €, the business pays 25 % for night work,
 * unless a case says otherwise. Wednesday is 11.11.2026, a working day in Hamburg.
 */
const NACHT_25 = { nacht: 2500 };

describe("R-29 Steuerfreie Zuschläge (§ 3b EStG)", () => {
  it("erlaubt: Mi 22:00 – 23:00 – 5,00 € steuerfrei", () => {
    const tag = einTag(
      rechne(
        schicht("2026-11-11T22:00+01:00", "2026-11-11T23:00+01:00"),
        stundenlohn(2000),
        NACHT_25,
      ),
    );
    expect(tag.arten.nacht).toEqual({
      gezahltCent: 500,
      steuerfreiCent: 500,
      steuerpflichtigCent: 0,
    });
    expect(tag.summe.steuerfreiCent).toBe(500);
  });

  it("Grenze: Grundlohn 50 €, Mi 22:00 – 23:00, gezahlt 25 % – 12,50 € steuerfrei", () => {
    const tag = einTag(
      rechne(
        schicht("2026-11-11T22:00+01:00", "2026-11-11T23:00+01:00"),
        stundenlohn(5000),
        NACHT_25,
      ),
    );
    expect(tag.arten.nacht).toEqual({
      gezahltCent: 1250,
      steuerfreiCent: 1250,
      steuerpflichtigCent: 0,
    });
  });

  it("Verstoß: Grundlohn 60 €, gezahlt 15 € – 12,50 € steuerfrei, 2,50 € steuerpflichtig", () => {
    const tag = einTag(
      rechne(
        schicht("2026-11-11T22:00+01:00", "2026-11-11T23:00+01:00"),
        stundenlohn(6000),
        NACHT_25,
      ),
    );
    expect(tag.arten.nacht).toEqual({
      gezahltCent: 1500,
      steuerfreiCent: 1250,
      steuerpflichtigCent: 250,
    });
  });

  it("Abs. 3: Beginn Sa 22:00, Arbeit So 0:00 – 4:00 – 40 % Nacht + 50 % Sonntag je Stunde", () => {
    const tag = einTag(
      rechne(
        schicht("2026-11-14T22:00+01:00", "2026-11-15T04:00+01:00"),
        stundenlohn(2000),
        NACHT_25,
      ),
    );
    const sonntag = tag.abschnitte.find((a) => a.tag === "2026-11-15");
    expect(sonntag).toMatchObject({
      minuten: 240,
      nacht: "nacht_0_4",
      tagesarten: ["sonntag"],
      folgetag: false,
    });
    expect(sonntag?.steuerfrei).toEqual({ nacht: 4000, tag: 5000, tagesart: "sonntag" });
    // the 25 % paid stay below the 90 % allowed: all of it is tax-free (6 h × 5,00 €)
    expect(tag.summe).toEqual({ gezahltCent: 3000, steuerfreiCent: 3000, steuerpflichtigCent: 0 });
  });

  it("Abs. 3: Beginn So 22:00, Arbeit Mo 0:00 – 4:00 – 40 % Nacht + 50 % (Mo bis 4 Uhr gilt als Sonntag)", () => {
    const tag = einTag(
      rechne(
        schicht("2026-11-15T22:00+01:00", "2026-11-16T04:00+01:00"),
        stundenlohn(2000),
        NACHT_25,
      ),
    );
    expect(tag.tag).toBe("2026-11-15");
    const montag = tag.abschnitte.find((a) => a.tag === "2026-11-16");
    expect(montag).toMatchObject({
      minuten: 240,
      nacht: "nacht_0_4",
      tagesarten: ["sonntag"],
      folgetag: true,
    });
    expect(montag?.steuerfrei).toEqual({ nacht: 4000, tag: 5000, tagesart: "sonntag" });
  });

  it("Feiertag: Arbeit am 1.5. 10:00 – 12:00 – 150 %", () => {
    const tag = einTag(
      rechne(schicht("2026-05-01T10:00+02:00", "2026-05-01T12:00+02:00"), stundenlohn(2000), {
        feiertag: 15000,
      }),
    );
    expect(saetzeVon(tag)).toEqual([
      { von: "10:00", bis: "12:00", minuten: 120, steuerfreiProzent: 150 },
    ]);
    // 2 h × 20 € × 150 % = 60,00 €, all of it tax-free, paid as the holiday rate of 1.5. (feiertag150 defaults to feiertag)
    expect(tag.arten.feiertag).toEqual({
      gezahltCent: 6000,
      steuerfreiCent: 6000,
      steuerpflichtigCent: 0,
    });
  });
});

/*
 * The examples of R 3b Abs. 3 and 4 LStR (Lohnsteuer-Richtlinien 2023) as docs/regeln.md states them.
 * The official handbook (lsth.bundesfinanzministerium.de) could not be reached from the session that
 * wrote them; the norm text of § 3b EStG was read on gesetze-im-internet.de/estg/__3b.html.
 */
describe("R-29: the examples of R 3b LStR and H 3b LStH", () => {
  it("R 3b Abs. 3 LStR, Beispiel: Beginn 1.5. 22:00, Ende 2.5. 7:00 – 175 %, 190 % von 0 bis 4 Uhr, 25 % von 4 bis 6 Uhr", () => {
    const tag = einTag(
      rechne(schicht("2026-05-01T22:00+02:00", "2026-05-02T07:00+02:00"), stundenlohn(2000), {}),
    );
    expect(saetzeVon(tag)).toEqual([
      { von: "22:00", bis: "00:00", minuten: 120, steuerfreiProzent: 175 },
      { von: "00:00", bis: "04:00", minuten: 240, steuerfreiProzent: 190 },
      { von: "04:00", bis: "06:00", minuten: 120, steuerfreiProzent: 25 },
      { von: "06:00", bis: "07:00", minuten: 60, steuerfreiProzent: 0 },
    ]);
    expect(tag.abschnitte[1]).toMatchObject({ folgetag: true, feiertag: "Tag der Arbeit" });
  });

  it("R 3b Abs. 3 LStR, nur ein Zuschlag: So 22:00 – 23:00, gezahlt nur 60 % Nacht – 60 % steuerfrei (25 % + 50 %)", () => {
    const tag = einTag(
      rechne(schicht("2026-11-15T22:00+01:00", "2026-11-15T23:00+01:00"), stundenlohn(2000), {
        nacht: 6000,
      }),
    );
    expect(tag.arten.nacht).toEqual({
      gezahltCent: 1200,
      steuerfreiCent: 1200,
      steuerpflichtigCent: 0,
    });
    expect(tag.arten.sonntag).toEqual({
      gezahltCent: 0,
      steuerfreiCent: 0,
      steuerpflichtigCent: 0,
    });
  });

  it("R 3b Abs. 3 LStR, nur ein Zuschlag über beiden Sätzen: gezahlt 80 % Nacht – 75 % steuerfrei, 5 % steuerpflichtig", () => {
    const tag = einTag(
      rechne(schicht("2026-11-15T22:00+01:00", "2026-11-15T23:00+01:00"), stundenlohn(2000), {
        nacht: 8000,
      }),
    );
    expect(tag.arten.nacht).toEqual({
      gezahltCent: 1600,
      steuerfreiCent: 1500,
      steuerpflichtigCent: 100,
    });
  });

  it("R 3b Abs. 4 LStR: Ostersonntag 5.4.2026 10:00 – 12:00 in Brandenburg, gezahlt 50 % Sonntag und 125 % Feiertag – 125 %, nicht 175 %", () => {
    const stempel = schicht("2026-04-05T10:00+02:00", "2026-04-05T12:00+02:00");
    const saetze = { sonntag: 5000, feiertag: 12500 };
    const brandenburg = einTag(rechne(stempel, stundenlohn(2000), saetze, BRANDENBURG));
    expect(saetzeVon(brandenburg)[0]?.steuerfreiProzent).toBe(125);
    expect(brandenburg.arten.feiertag).toEqual({
      gezahltCent: 5000,
      steuerfreiCent: 5000,
      steuerpflichtigCent: 0,
    });
    expect(brandenburg.arten.sonntag.gezahltCent).toBe(0);
    // Ostersonntag is no legal holiday in Hamburg: a Sunday, 50 %
    const hamburg = einTag(rechne(stempel, stundenlohn(2000), saetze, HAMBURG));
    expect(saetzeVon(hamburg)[0]?.steuerfreiProzent).toBe(50);
    expect(hamburg.arten.sonntag).toEqual({
      gezahltCent: 2000,
      steuerfreiCent: 2000,
      steuerpflichtigCent: 0,
    });
  });

  it("R 3b Abs. 4 LStR, nur ein Sonntagszuschlag: Ostersonntag in Brandenburg, gezahlt nur 100 % Sonntag – steuerfrei bis 125 %", () => {
    const stempel = schicht("2026-04-05T10:00+02:00", "2026-04-05T12:00+02:00");
    const tag = einTag(rechne(stempel, stundenlohn(2000), { sonntag: 10000 }, BRANDENBURG));
    expect(tag.summe).toEqual({ gezahltCent: 4000, steuerfreiCent: 4000, steuerpflichtigCent: 0 });
  });
});

describe("R-29: further cases", () => {
  it("Beginn um 0 Uhr: Mo 0:00 – 4:00 nach freiem Sonntag – 25 %, kein Sonntag, keine 40 %", () => {
    const tag = einTag(
      rechne(
        schicht("2026-11-16T00:00+01:00", "2026-11-16T04:00+01:00"),
        stundenlohn(2000),
        NACHT_25,
      ),
    );
    expect(tag.abschnitte[0]).toMatchObject({ nacht: "nacht", tagesarten: [], folgetag: false });
    expect(saetzeVon(tag)[0]?.steuerfreiProzent).toBe(25);
  });

  it("Zeitumstellung Oktober: Sa 24.10.2026 22:00 – So 25.10. 6:00 – 0 bis 4 Uhr sind 5 h zu 90 %", () => {
    const tag = einTag(
      rechne(
        schicht("2026-10-24T22:00+02:00", "2026-10-25T06:00+01:00"),
        stundenlohn(2000),
        NACHT_25,
      ),
    );
    expect(saetzeVon(tag)).toEqual([
      { von: "22:00", bis: "00:00", minuten: 120, steuerfreiProzent: 25 },
      { von: "00:00", bis: "04:00", minuten: 300, steuerfreiProzent: 90 },
      { von: "04:00", bis: "06:00", minuten: 120, steuerfreiProzent: 75 },
    ]);
    // 9 h × 5,00 € night surcharge
    expect(tag.arten.nacht.gezahltCent).toBe(4500);
  });

  it("Zeitumstellung März: Sa 27.3.2027 22:00 – So 28.3. 6:00 – 0 bis 4 Uhr sind 3 h zu 90 %", () => {
    const tag = einTag(
      rechne(
        schicht("2027-03-27T22:00+01:00", "2027-03-28T06:00+02:00"),
        stundenlohn(2000),
        NACHT_25,
      ),
    );
    expect(saetzeVon(tag).map((s) => s.minuten)).toEqual([120, 180, 120]);
    expect(tag.arten.nacht.gezahltCent).toBe(3500);
  });

  it("Feiertag über Mitternacht: Do 30.4. 22:00 – Fr 1.5. 6:00 – 25 %, 190 %, 175 %, Arbeitstag 30.4.", () => {
    const tag = einTag(
      rechne(schicht("2026-04-30T22:00+02:00", "2026-05-01T06:00+02:00"), stundenlohn(2000), {}),
    );
    expect(tag.tag).toBe("2026-04-30");
    expect(saetzeVon(tag).map((s) => s.steuerfreiProzent)).toEqual([25, 190, 175]);
  });

  it("24.12. ab 14 Uhr: Do 24.12.2026 12:00 – 16:00 – bis 14 Uhr nichts, danach 150 %", () => {
    const tag = einTag(
      rechne(schicht("2026-12-24T12:00+01:00", "2026-12-24T16:00+01:00"), stundenlohn(2000), {
        heiligabend: 15000,
      }),
    );
    expect(saetzeVon(tag)).toEqual([
      { von: "12:00", bis: "14:00", minuten: 120, steuerfreiProzent: 0 },
      { von: "14:00", bis: "16:00", minuten: 120, steuerfreiProzent: 150 },
    ]);
    expect(tag.arten.feiertag).toEqual({
      gezahltCent: 6000,
      steuerfreiCent: 6000,
      steuerpflichtigCent: 0,
    });
  });

  it("31.12. ab 14 Uhr: Do 31.12.2026 12:00 – 16:00 – bis 14 Uhr nichts, danach 125 %; ohne Satz des Betriebs nichts gezahlt", () => {
    const stempel = schicht("2026-12-31T12:00+01:00", "2026-12-31T16:00+01:00");
    const tag = einTag(rechne(stempel, stundenlohn(2000), { feiertag: 12500 }));
    expect(saetzeVon(tag).map((s) => s.steuerfreiProzent)).toEqual([0, 125]);
    expect(tag.summe.gezahltCent).toBe(0);
    const mitSilvester = einTag(rechne(stempel, stundenlohn(2000), { silvester: 12500 }));
    expect(mitSilvester.arten.feiertag).toEqual({
      gezahltCent: 5000,
      steuerfreiCent: 5000,
      steuerpflichtigCent: 0,
    });
  });

  it("Jahreswechsel: Do 31.12.2026 22:00 – Fr 1.1.2027 6:00 – 150 %, 165 %, 150 %", () => {
    const tag = einTag(
      rechne(schicht("2026-12-31T22:00+01:00", "2027-01-01T06:00+01:00"), stundenlohn(2000), {}),
    );
    expect(tag.tag).toBe("2026-12-31");
    expect(saetzeVon(tag).map((s) => s.steuerfreiProzent)).toEqual([150, 165, 150]);
  });

  it("Grundlohn über 50 €: 80 € je Stunde, Fr 1.5. 10:00 – 11:00, gezahlt 150 % – 75,00 € steuerfrei, 45,00 € steuerpflichtig", () => {
    const tag = einTag(
      rechne(schicht("2026-05-01T10:00+02:00", "2026-05-01T11:00+02:00"), stundenlohn(8000), {
        feiertag: 15000,
      }),
    );
    expect(tag.arten.feiertag).toEqual({
      gezahltCent: 12000,
      steuerfreiCent: 7500,
      steuerpflichtigCent: 4500,
    });
  });

  it("nicht hinterlegt: ein Arbeitstag vor der ersten Regelversion (31.12.2025)", () => {
    const ergebnis = rechne(
      schicht("2025-12-31T22:00+01:00", "2026-01-01T02:00+01:00"),
      stundenlohn(2000),
      NACHT_25,
    );
    expect(ergebnis.tage).toEqual([]);
    expect(ergebnis.nichtHinterlegt).toEqual(["2025-12-31"]);
  });
});

describe("zuschlaege: input and rounding", () => {
  it("refuses rates and wages that are not whole, non-negative numbers", () => {
    const stempel: never[] = [];
    const ok = { grundlohn: stundenlohn(2000), saetze: {}, standort: HAMBURG };
    expect(zuschlaege(stempel, ok).ok).toBe(true);
    expect(zuschlaege(stempel, { ...ok, saetze: { nacht: 25.5 } }).ok).toBe(false);
    expect(zuschlaege(stempel, { ...ok, saetze: { nacht: -1 } }).ok).toBe(false);
    expect(zuschlaege(stempel, { ...ok, grundlohn: stundenlohn(20.5) }).ok).toBe(false);
    expect(
      zuschlaege(stempel, { ...ok, grundlohn: { art: "monat", cent: 300000, wochenMinuten: 0 } })
        .ok,
    ).toBe(false);
  });

  it("rounds the paid amount up and the tax-free part down: 13,90 € × 25 % for 7 min", () => {
    // 1390 × 0,25 × 7 ÷ 60 = 40,54… cents: 41 paid, of it 40 tax-free, never more than the limit
    const tag = einTag(
      rechne(
        schicht("2026-11-11T22:00+01:00", "2026-11-11T22:07+01:00"),
        stundenlohn(1390),
        NACHT_25,
      ),
    );
    expect(tag.arten.nacht).toEqual({
      gezahltCent: 41,
      steuerfreiCent: 40,
      steuerpflichtigCent: 1,
    });
  });

  it("counts only the work of closed shifts, without Ruhepausen", () => {
    const tag = einTag(
      rechne(
        [
          { art: "kommen", zeitpunkt: Date.parse("2026-11-11T21:00+01:00") },
          { art: "pause_beginn", zeitpunkt: Date.parse("2026-11-11T22:00+01:00") },
          { art: "pause_ende", zeitpunkt: Date.parse("2026-11-11T22:30+01:00") },
          { art: "gehen", zeitpunkt: Date.parse("2026-11-11T23:00+01:00") },
        ],
        stundenlohn(2000),
        NACHT_25,
      ),
    );
    // 21:00 – 22:00 and 22:30 – 23:00: 90 min of night work at 5,00 € an hour
    expect(tag.arten.nacht.gezahltCent).toBe(750);
  });
});

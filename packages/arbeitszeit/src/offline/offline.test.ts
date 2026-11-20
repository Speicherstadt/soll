import { describe, expect, it } from "vitest";
import { nummernLuecken, offlineZeitpunkt, stempelNachricht } from "./offline.ts";

describe("stempelNachricht (S-305)", () => {
  const eintrag = {
    geraetId: "6f1c2a1e-6d4f-4c7e-9a43-2c1f0e9b7d10",
    nummer: 3,
    art: "kommen" as const,
    geraetZeitpunkt: Date.parse("2026-11-20T07:58:00+01:00"),
  };

  it("is the same text for the same entry, whatever the order of its fields", () => {
    const umgekehrt = {
      geraetZeitpunkt: eintrag.geraetZeitpunkt,
      art: eintrag.art,
      nummer: eintrag.nummer,
      geraetId: eintrag.geraetId,
    };
    expect(stempelNachricht(umgekehrt)).toBe(stempelNachricht(eintrag));
    expect(stempelNachricht(eintrag)).toBe(
      `["soll/stempel/1","${eintrag.geraetId}",3,"kommen",${eintrag.geraetZeitpunkt}]`,
    );
  });

  it("differs in every field, so a signature covers each of them", () => {
    const basis = stempelNachricht(eintrag);
    for (const anders of [
      { ...eintrag, geraetId: "anderes-geraet" },
      { ...eintrag, nummer: 4 },
      { ...eintrag, art: "gehen" as const },
      { ...eintrag, geraetZeitpunkt: eintrag.geraetZeitpunkt + 1 },
    ])
      expect(stempelNachricht(anders), JSON.stringify(anders)).not.toBe(basis);
  });

  it("cannot be shifted from one field into the next by quoting", () => {
    expect(stempelNachricht({ ...eintrag, geraetId: 'a",3,"kommen' })).not.toBe(
      stempelNachricht({ ...eintrag, geraetId: "a" }),
    );
  });
});

describe("nummernLuecken (S-305)", () => {
  it("has no gap for 1 to n in any order, nor for nothing", () => {
    expect(nummernLuecken([])).toEqual([]);
    expect(nummernLuecken([1])).toEqual([]);
    expect(nummernLuecken([3, 1, 2])).toEqual([]);
  });

  it("names a missing number in the middle and at the start", () => {
    expect(nummernLuecken([1, 3])).toEqual([{ von: 2, bis: 2 }]);
    expect(nummernLuecken([2, 3])).toEqual([{ von: 1, bis: 1 }]);
  });

  it("joins neighbouring missing numbers into one range and keeps ranges apart", () => {
    expect(nummernLuecken([1, 5, 7])).toEqual([
      { von: 2, bis: 4 },
      { von: 6, bis: 6 },
    ]);
  });

  it("counts a number twice once", () => {
    expect(nummernLuecken([1, 1, 2, 4, 4])).toEqual([{ von: 3, bis: 3 }]);
  });

  it("names a huge gap as one range without listing it", () => {
    expect(nummernLuecken([1, 2_000_000_000])).toEqual([{ von: 2, bis: 1_999_999_999 }]);
  });

  it("closes a gap once the missing entry arrives late", () => {
    expect(nummernLuecken([1, 3, 2])).toEqual([]);
  });
});

describe("offlineZeitpunkt (S-305)", () => {
  const um = (zeit: string) => Date.parse(`2026-11-20T${zeit}+01:00`);

  it("takes the device's time when its clock matches the server's", () => {
    expect(
      offlineZeitpunkt({
        geraetZeitpunkt: um("07:58"),
        gesendetAm: um("09:00"),
        empfangen: um("09:00"),
      }),
    ).toEqual({ ok: true, zeitpunkt: um("07:58") });
  });

  it("moves the device's time by how far its clock is off at sending", () => {
    // the phone runs 10 minutes fast: stamped at 08:08 on its clock, sent at 09:10 on it, 09:00 here
    expect(
      offlineZeitpunkt({
        geraetZeitpunkt: um("08:08"),
        gesendetAm: um("09:10"),
        empfangen: um("09:00"),
      }),
    ).toEqual({ ok: true, zeitpunkt: um("07:58") });
  });

  it("refuses an entry stamped after it was sent", () => {
    expect(
      offlineZeitpunkt({
        geraetZeitpunkt: um("09:01"),
        gesendetAm: um("09:00"),
        empfangen: um("09:00"),
      }),
    ).toEqual({ ok: false });
  });

  it("takes an entry sent the same millisecond it was stamped at the time of receipt", () => {
    expect(
      offlineZeitpunkt({
        geraetZeitpunkt: um("09:00"),
        gesendetAm: um("09:00"),
        empfangen: um("09:05"),
      }),
    ).toEqual({ ok: true, zeitpunkt: um("09:05") });
  });
});

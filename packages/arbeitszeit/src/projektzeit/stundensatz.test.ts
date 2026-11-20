import { describe, expect, it } from "vitest";
import { type Satz, stundensatz } from "./stundensatz.ts";

// Weber Haustechnik: Kunde Elbhof, Auftrag Bad Elbhof (of Elbhof), Tätigkeit Montage, Sandra
const BUCHUNG = {
  kundeId: "elbhof",
  projektId: "bad",
  taetigkeitId: "montage",
  nutzerId: "sandra",
  tag: "2026-11-20",
};

const satz = (id: string, centProStunde: number, felder: Partial<Satz> = {}): Satz => ({
  satzId: id,
  kundeId: null,
  projektId: null,
  taetigkeitId: null,
  nutzerId: null,
  gueltigAb: "2026-01-01",
  centProStunde,
  ...felder,
});

/** Every level of the precedence, from the most specific to the business's default */
const STUFEN: Satz[] = [
  satz("taetigkeit+person", 9_000, { taetigkeitId: "montage", nutzerId: "sandra" }),
  satz("taetigkeit", 8_500, { taetigkeitId: "montage" }),
  satz("projekt+person", 8_000, { projektId: "bad", nutzerId: "sandra" }),
  satz("projekt", 7_500, { projektId: "bad" }),
  satz("kunde+person", 7_000, { kundeId: "elbhof", nutzerId: "sandra" }),
  satz("kunde", 6_500, { kundeId: "elbhof" }),
  satz("person", 6_000, { nutzerId: "sandra" }),
  satz("betrieb", 5_500),
];

describe("stundensatz", () => {
  it("takes each level before the ones below it (Kimai: activity 5, project 3, customer 1, user +1)", () => {
    STUFEN.forEach((oben, index) => {
      expect(stundensatz(STUFEN.slice(index), BUCHUNG), oben.satzId).toEqual({
        art: "satz",
        satzId: oben.satzId,
        centProStunde: oben.centProStunde,
      });
      // the order of the list does not matter
      expect(stundensatz([...STUFEN.slice(index)].reverse(), BUCHUNG)).toMatchObject({
        satzId: oben.satzId,
      });
    });
  });

  it("says nicht hinterlegt without a fitting rate", () => {
    expect(stundensatz([], BUCHUNG)).toEqual({ art: "nicht_hinterlegt" });
    const fremd = [
      satz("anderer-kunde", 1, { kundeId: "hafen" }),
      satz("anderes-projekt", 1, { projektId: "kueche" }),
      satz("andere-taetigkeit", 1, { taetigkeitId: "wartung" }),
      satz("andere-person", 1, { nutzerId: "max" }),
      satz("person-und-anderes-projekt", 1, { projektId: "kueche", nutzerId: "sandra" }),
    ];
    expect(stundensatz(fremd, BUCHUNG)).toEqual({ art: "nicht_hinterlegt" });
  });

  it("takes an activity of a project before the activity alone and before the person", () => {
    const saetze = [
      satz("taetigkeit+person", 1, { taetigkeitId: "montage", nutzerId: "sandra" }),
      satz("taetigkeit+projekt", 2, { taetigkeitId: "montage", projektId: "bad" }),
    ];
    expect(stundensatz(saetze, BUCHUNG)).toMatchObject({ satzId: "taetigkeit+projekt" });
  });

  it("takes the rate in force on the day: the latest valid from on or before it", () => {
    const saetze = [
      satz("alt", 6_000, { kundeId: "elbhof", gueltigAb: "2026-01-01" }),
      satz("neu", 6_500, { kundeId: "elbhof", gueltigAb: "2026-11-20" }),
      satz("kuenftig", 7_000, { kundeId: "elbhof", gueltigAb: "2026-12-01" }),
    ];
    expect(stundensatz(saetze, BUCHUNG)).toMatchObject({ satzId: "neu" });
    expect(stundensatz(saetze, { ...BUCHUNG, tag: "2026-11-19" })).toMatchObject({
      satzId: "alt",
    });
    expect(stundensatz(saetze, { ...BUCHUNG, tag: "2025-12-31" })).toEqual({
      art: "nicht_hinterlegt",
    });
  });

  it("does not let a rate that holds later hide a less specific one in force", () => {
    const saetze = [
      satz("taetigkeit-ab-dezember", 9_000, { taetigkeitId: "montage", gueltigAb: "2026-12-01" }),
      satz("kunde", 6_500, { kundeId: "elbhof" }),
    ];
    expect(stundensatz(saetze, BUCHUNG)).toMatchObject({ satzId: "kunde" });
  });

  it("books without an order: only rates of the activity, the person and the business fit", () => {
    const ohne = { taetigkeitId: "fahrt", nutzerId: "sandra", tag: "2026-11-20" };
    expect(stundensatz(STUFEN, { ...ohne, kundeId: null, projektId: null })).toMatchObject({
      satzId: "person",
    });
  });
});

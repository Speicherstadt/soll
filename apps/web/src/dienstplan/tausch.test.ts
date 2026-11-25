import { describe, expect, it } from "vitest";
import { aktionenFuer, type TauschAnsicht } from "./tausch.ts";

/* Which steps a person has on a swap (S-504) */

const tausch = (felder: Partial<TauschAnsicht> = {}): TauschAnsicht => ({
  tauschId: "t1",
  status: "offen",
  schicht: {
    schichtId: "s1",
    standortId: "elbe",
    tag: "2026-11-23",
    beginn: 0,
    ende: 1,
    pauseMinuten: 30,
    rolle: "Service",
  },
  anbieter: { nutzerId: "tom", name: "Tom" },
  an: null,
  uebernehmer: null,
  grund: null,
  angebotenAm: 0,
  befunde: null,
  ...felder,
});

const yusuf = { nutzerId: "yusuf", planer: false };
const lea = { nutzerId: "lea", planer: true };
const tom = { nutzerId: "tom", planer: false };

describe("aktionenFuer", () => {
  it("lets a colleague take an open offer meant for them, the offerer withdraw it", () => {
    expect(aktionenFuer(tausch(), yusuf)).toEqual(["uebernehmen"]);
    expect(aktionenFuer(tausch(), tom)).toEqual(["zurueckziehen"]);
    const anOlena = tausch({ an: { nutzerId: "olena", name: "Olena" } });
    expect(aktionenFuer(anOlena, yusuf)).toEqual([]);
  });

  it("lets whoever plans approve a taken swap and refuse an undecided one", () => {
    expect(aktionenFuer(tausch(), lea)).toEqual(["uebernehmen", "ablehnen"]);
    const genommen = tausch({ status: "uebernommen", uebernehmer: { nutzerId: "y", name: "Y" } });
    expect(aktionenFuer(genommen, lea)).toEqual(["freigeben", "ablehnen"]);
    expect(aktionenFuer(genommen, yusuf)).toEqual([]);
    expect(aktionenFuer(genommen, tom)).toEqual(["zurueckziehen"]);
  });

  it("has no step on a decided swap", () => {
    for (const status of ["freigegeben", "abgelehnt", "zurueckgezogen", "hinfaellig"] as const)
      for (const ich of [yusuf, lea, tom])
        expect(aktionenFuer(tausch({ status }), ich)).toEqual([]);
  });
});

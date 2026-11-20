import { describe, expect, it } from "vitest";
import { kanonisch } from "../audit/hash.ts";
import { abweichendeTage, aufzeichnungen, inhaltHash, monatsinhalt } from "./monatsinhalt.ts";

const ms = (text: string) => Date.parse(text);
const vollzeit = (tag: string) =>
  [6, 0].includes(new Date(`${tag}T12:00:00Z`).getUTCDay()) ? 0 : 480;

// Lea, Café Elbblick, October 2026: a day shift, and a night shift from 31 October into November
const stempel = [
  { art: "kommen", zeitpunkt: ms("2026-10-01T08:00:00+02:00") },
  { art: "pause_beginn", zeitpunkt: ms("2026-10-01T12:00:00+02:00") },
  { art: "pause_ende", zeitpunkt: ms("2026-10-01T12:30:00+02:00") },
  { art: "gehen", zeitpunkt: ms("2026-10-01T16:30:00+02:00") },
  { art: "kommen", zeitpunkt: ms("2026-10-31T22:00:00+01:00") },
  { art: "gehen", zeitpunkt: ms("2026-11-01T04:00:00+01:00") },
  { art: "kommen", zeitpunkt: ms("2026-11-02T08:00:00+01:00") },
] as const;

const oktober = () => aufzeichnungen("2026-10", stempel, vollzeit);

describe("aufzeichnungen", () => {
  it("lists every day of the month with its stamps and the model's minutes", () => {
    const tage = oktober();
    expect(tage).toHaveLength(31);
    expect(tage[0]).toEqual({
      tag: "2026-10-01",
      stempel: [
        ["kommen", ms("2026-10-01T08:00:00+02:00")],
        ["pause_beginn", ms("2026-10-01T12:00:00+02:00")],
        ["pause_ende", ms("2026-10-01T12:30:00+02:00")],
        ["gehen", ms("2026-10-01T16:30:00+02:00")],
      ],
      modellMinuten: 480,
    });
    expect(tage[2]).toEqual({ tag: "2026-10-03", stempel: [], modellMinuten: 0 });
  });

  it("files a night shift's Gehen after midnight under the day the shift began", () => {
    expect(oktober()[30]?.stempel).toEqual([
      ["kommen", ms("2026-10-31T22:00:00+01:00")],
      ["gehen", ms("2026-11-01T04:00:00+01:00")],
    ]);
    const november = aufzeichnungen("2026-11", stempel, vollzeit);
    expect(november[0]?.stempel).toEqual([]);
    expect(november[1]?.stempel).toEqual([["kommen", ms("2026-11-02T08:00:00+01:00")]]);
  });

  it("keeps a missing model as null, never as 0", () => {
    expect(aufzeichnungen("2026-10", [], () => null)[0]?.modellMinuten).toBeNull();
  });

  it("does not depend on the order the stamps come in", () => {
    expect(aufzeichnungen("2026-10", [...stempel].reverse(), vollzeit)).toEqual(oktober());
  });
});

const inhalt = () =>
  monatsinhalt({
    monat: "2026-10",
    nutzerId: "lea",
    tage: oktober(),
    summen: {
      sollMinuten: 10_560,
      gearbeitetMinuten: 840,
      gutschriftMinuten: 0,
      istMinuten: 840,
      saldoMinuten: -9_720,
    },
    nichtHinterlegt: [],
    befunde: [
      {
        regel: "R-04",
        norm: "§ 4 ArbZG",
        schwere: "verstoss",
        art: "ohne_pause",
        tage: ["2026-10-31"],
        // a rule's own fields do not enter the content
        ...{ schicht: 1 },
      },
    ],
  });

describe("Monatsinhalt and its hash (test vectors)", () => {
  it("has a canonical form", () => {
    const text = kanonisch(inhalt());
    expect(
      text.startsWith('{"befunde":[{"art":"ohne_pause","norm":"§ 4 ArbZG","regel":"R-04"'),
    ).toBe(true);
    expect(text).toContain(
      '"fassung":1,"gegeneintraege":[],"monat":"2026-10","nichtHinterlegt":[],"nutzerId":"lea"',
    );
    expect(text).not.toContain("schicht");
  });

  // the vector was checked apart from this code: Python json.dumps(sort_keys=True,
  // separators=(",", ":"), ensure_ascii=False) of the same object, hashed with hashlib.sha256
  it("gives the same hash for the same content", () => {
    expect(inhaltHash(inhalt())).toBe(
      "d46913872ebd74f377a1b4064bf8ac587d97008481f9de33aa22f4853ecfaa93",
    );
  });

  it("gives another hash when one minute changes", () => {
    const anders = inhalt();
    const tag = anders.tage[0];
    if (tag?.stempel[3]) tag.stempel[3][1] += 60_000;
    expect(inhaltHash(anders)).not.toBe(inhaltHash(inhalt()));
  });

  it("gives another hash when the Soll is nicht hinterlegt instead", () => {
    expect(inhaltHash({ ...inhalt(), summen: null, nichtHinterlegt: ["2026-10-01"] })).not.toBe(
      inhaltHash(inhalt()),
    );
  });
});

describe("abweichendeTage", () => {
  it("is empty for the same records", () => {
    expect(abweichendeTage(oktober(), oktober())).toEqual([]);
  });

  it("names a day whose stamp moved, was removed or added, or whose Soll changed", () => {
    const jetzt = oktober().map((tag) => ({ ...tag, stempel: [...tag.stempel] }));
    const erster = jetzt[0];
    const fuenfter = jetzt[4];
    const zehnter = jetzt[9];
    if (!erster || !fuenfter || !zehnter) throw new Error("days missing");
    erster.stempel[3] = ["gehen", ms("2026-10-01T17:30:00+02:00")];
    fuenfter.stempel.push(["kommen", ms("2026-10-05T08:00:00+02:00")]);
    zehnter.modellMinuten = 240;
    expect(abweichendeTage(oktober(), jetzt)).toEqual(["2026-10-01", "2026-10-05", "2026-10-10"]);
  });
});

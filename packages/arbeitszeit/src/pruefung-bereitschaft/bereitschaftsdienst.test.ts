import { describe, expect, it } from "vitest";
import {
  kurz,
  MO,
  mitBereitschaft,
  pause,
  pruefe,
  schicht,
  spanne,
  uhr,
  um,
  weiter,
} from "./testhilfen.ts";

/*
 * docs/regeln.md, R-11 (cases taken literally): Bereitschaftsdienst at the place the business
 * decides is working time (§ 2 Abs. 1 ArbZG; EuGH C-151/02, Jaeger) and enters §§ 3 to 5 ArbZG like
 * any other work. The cases erlaubt, Grenze and Verstoß grant the breaks of § 4 ArbZG.
 */
const TARIF = { tarif: { fundstelle: "TV-Ärzte/VKA § 10 Abs. 1" } };

/** 6:00 Arbeit from 8:00, then `pause` minutes off, then Bereitschaftsdienst until `bis` */
const sechsStundenUnd = (pauseBis: string, bis: string) => ({
  stempel: schicht(uhr(MO, "8:00"), uhr(MO, "14:00")),
  eingabe: { bereitschaftsdienste: [spanne(uhr(MO, pauseBis), uhr(MO, bis))] },
});

describe("R-11: Bereitschaftsdienst", () => {
  it("erlaubt: 6:00 Arbeit + 2:00 Bereitschaftsdienst – 8:00 Arbeitszeit, no finding", () => {
    const { stempel, eingabe } = sechsStundenUnd("14:30", "16:30");
    const [tag] = mitBereitschaft(stempel, eingabe);
    expect(tag).toMatchObject({
      tag: "2026-11-16",
      arbeitsMinuten: 480,
      bereitschaftsMinuten: 120,
    });
    expect(pruefe(stempel, eingabe)).toEqual({ befunde: [], nichtHinterlegt: [] });
  });

  it("Grenze: 6:00 Arbeit + 4:00 Bereitschaftsdienst – 10:00, Hinweis of R-02", () => {
    const { stempel, eingabe } = sechsStundenUnd("14:45", "18:45");
    expect(pruefe(stempel, eingabe).befunde).toEqual([
      {
        regel: "R-02",
        norm: "§ 3 Satz 2 ArbZG",
        schwere: "hinweis",
        art: "ueber_8h",
        tage: ["2026-11-16"],
        minuten: 600,
        ueber: 120,
      },
    ]);
  });

  it("Verstoß: 6:00 Arbeit + 4:01 Bereitschaftsdienst without § 7 – Verstoß of R-02", () => {
    const { stempel, eingabe } = sechsStundenUnd("14:45", "18:46");
    expect(pruefe(stempel, eingabe).befunde).toEqual([
      {
        regel: "R-02",
        norm: "§ 3 Satz 2 ArbZG",
        schwere: "verstoss",
        art: "ueber_10h",
        tage: ["2026-11-16"],
        minuten: 601,
        ueber: 1,
      },
    ]);
  });

  it("Pause: 6:00 Arbeit + 2:00 Bereitschaftsdienst without a Ruhepause – Verstöße of R-04", () => {
    const { stempel, eingabe } = sechsStundenUnd("14:00", "16:00");
    expect(kurz(pruefe(stempel, eingabe))).toEqual([
      ["R-04", "pause_fehlt", ["2026-11-16"]],
      ["R-04", "ohne_pause", ["2026-11-16"]],
    ]);
    expect(pruefe(stempel, eingabe).befunde[0]).toMatchObject({ fehlt: 30, arbeitsMinuten: 480 });
  });

  it("gestempelt: 8:00 – 16:00 stamped, 14:00 – 16:00 of it Bereitschaftsdienst – 8:00, not twice", () => {
    const stempel = schicht(uhr(MO, "8:00"), uhr(MO, "16:00"));
    const eingabe = { bereitschaftsdienste: [spanne(uhr(MO, "14:00"), uhr(MO, "16:00"))] };
    const [tag] = mitBereitschaft(stempel, eingabe);
    expect(tag).toMatchObject({ arbeitsMinuten: 480, bereitschaftsMinuten: 120 });
    expect(tag?.schichten).toHaveLength(1);
  });

  it("gestempelt: Bereitschaftsdienst in a stamped break is no Ruhepause", () => {
    const stempel = [
      ...schicht(uhr(MO, "8:00"), uhr(MO, "16:30")).slice(0, 1),
      pause(uhr(MO, "12:00")),
      weiter(uhr(MO, "12:30")),
      ...schicht(uhr(MO, "8:00"), uhr(MO, "16:30")).slice(1),
    ];
    const eingabe = { bereitschaftsdienste: [spanne(uhr(MO, "12:00"), uhr(MO, "12:30"))] };
    const [tag] = mitBereitschaft(stempel, eingabe);
    expect(tag).toMatchObject({ arbeitsMinuten: 510, bereitschaftsMinuten: 30 });
    expect(tag?.schichten[0]?.pausen).toEqual([]);
  });

  it("Ruhezeit: Bereitschaftsdienst Mo 22:00 – Di 6:00, Di Schicht 15:30 – Verstoß of R-05 „Ruhezeit 9:30“", () => {
    const stempel = schicht(uhr("17", "15:30"), uhr("17", "19:30"));
    const eingabe = { bereitschaftsdienste: [spanne(uhr(MO, "22:00"), uhr("17", "6:00"))] };
    const ruhe = pruefe(stempel, eingabe).befunde.filter((befund) => befund.regel === "R-05");
    expect(ruhe).toEqual([
      {
        regel: "R-05",
        norm: "§ 5 Abs. 1 ArbZG",
        schwere: "verstoss",
        art: "ruhezeit_zu_kurz",
        tage: ["2026-11-16", "2026-11-17"],
        ruhe: { beginn: um(uhr("17", "6:00")), ende: um(uhr("17", "15:30")), minuten: 570 },
        mindestens: 660,
        fehlt: 90,
      },
    ]);
  });

  it("Herbst: Bereitschaftsdienst Sa 24.10.2026 22:00 – So 7:00 (10:00) – Hinweis of R-02 for Sa", () => {
    const eingabe = {
      bereitschaftsdienste: [spanne("2026-10-24T22:00+02:00", "2026-10-25T07:00+01:00")],
    };
    const [tag] = mitBereitschaft([], eingabe);
    expect(tag).toMatchObject({
      tag: "2026-10-24",
      arbeitsMinuten: 600,
      bereitschaftsMinuten: 600,
    });
    const ergebnis = pruefe([], eingabe);
    expect(ergebnis.befunde.filter((befund) => befund.regel === "R-02")).toMatchObject([
      { art: "ueber_8h", tage: ["2026-10-24"], minuten: 600 },
    ]);
  });

  it("Frühjahr: Bereitschaftsdienst Sa 27.03.2027 22:00 – So 7:00 is 8:00 – no finding of R-02", () => {
    const eingabe = {
      bereitschaftsdienste: [spanne("2027-03-27T22:00+01:00", "2027-03-28T07:00+02:00")],
    };
    expect(mitBereitschaft([], eingabe)[0]).toMatchObject({
      tag: "2027-03-27",
      arbeitsMinuten: 480,
    });
    expect(pruefe([], eingabe).befunde.filter((befund) => befund.regel === "R-02")).toEqual([]);
  });

  it("Tarif: 6:00 Arbeit + 6:00 Bereitschaftsdienst with § 7 – Hinweis of R-11 instead of a Verstoß", () => {
    const stempel = schicht(uhr(MO, "8:00"), uhr(MO, "14:00"));
    const eingabe = { bereitschaftsdienste: [spanne(uhr(MO, "14:45"), uhr(MO, "20:45"))] };
    expect(pruefe(stempel, eingabe, TARIF).befunde).toEqual([
      {
        regel: "R-11",
        norm: "§ 7 Abs. 1 Nr. 1 Buchst. a ArbZG",
        schwere: "hinweis",
        art: "ueber_10h_tarif",
        tage: ["2026-11-16"],
        minuten: 720,
        ueber: 120,
        fundstelle: "TV-Ärzte/VKA § 10 Abs. 1",
      },
    ]);
  });

  it("Tarif ohne Bereitschaft: 10:01 Arbeit with the same setting – Verstoß of R-02", () => {
    const stempel = [
      ...schicht(uhr(MO, "8:00"), uhr(MO, "14:00")),
      ...schicht(uhr(MO, "14:45"), uhr(MO, "18:46")),
    ];
    expect(kurz(pruefe(stempel, {}, TARIF))).toEqual([["R-02", "ueber_10h", ["2026-11-16"]]]);
  });

  it("über 12 h: Gastronomie, § 7, 6:00 + 7:00 Bereitschaftsdienst, then 10:30 rest – Verstoß of § 7 Abs. 9", () => {
    const stempel = [
      ...schicht(uhr(MO, "6:00"), uhr(MO, "12:00")),
      ...schicht(uhr("17", "6:30"), uhr("17", "12:30")),
    ];
    const eingabe = {
      bereitschaftsdienste: [
        spanne(uhr(MO, "12:45"), uhr(MO, "18:45")),
        spanne(uhr(MO, "19:00"), uhr(MO, "20:00")),
      ],
    };
    const optionen = { ...TARIF, branche: "gastronomie_beherbergung" } as const;
    expect(pruefe(stempel, eingabe, optionen).befunde).toEqual([
      expect.objectContaining({ regel: "R-11", art: "ueber_10h_tarif", minuten: 780 }),
      {
        regel: "R-11",
        norm: "§ 7 Abs. 9 ArbZG",
        schwere: "verstoss",
        art: "ruhezeit_nach_ueber_12h",
        tage: ["2026-11-16", "2026-11-17"],
        ruhe: { beginn: um(uhr(MO, "20:00")), ende: um(uhr("17", "6:30")), minuten: 630 },
        mindestens: 660,
        fehlt: 30,
        fundstelle: "TV-Ärzte/VKA § 10 Abs. 1",
      },
    ]);
    // without the agreement the day is a Verstoß of R-02, and the shortened rest a Hinweis of R-05
    expect(kurz(pruefe(stempel, eingabe, { branche: "gastronomie_beherbergung" }))).toEqual([
      ["R-02", "ueber_10h", ["2026-11-16"]],
    ]);
  });
});

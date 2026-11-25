import { describe, expect, it } from "vitest";
import { DI, kurz, MO, mitBereitschaft, pruefe, schicht, spanne, uhr, um } from "./testhilfen.ts";

/*
 * docs/regeln.md, R-12 (cases taken literally): Rufbereitschaft is no working time, a call-out is,
 * and it begins a new rest of 11 hours (§§ 2, 5 ArbZG); with a reaction time under 30 minutes the
 * whole duty counts (EuGH C-518/15, Matzak). The cases without a reaction time have one of 30
 * minutes or more. Mo is 16.11.2026.
 */
const einsatz = (beginn: string, ende: string) => ({ einsaetze: [spanne(beginn, ende)] });
const diSchicht = (beginn = "8:00", ende = "14:00") => schicht(uhr(DI, beginn), uhr(DI, ende));
const KRANKENHAUS = { branche: "krankenhaus_pflege" } as const;

describe("R-12: Rufbereitschaft", () => {
  it("erlaubt: Rufbereitschaft Mo 18:00 – Di 6:00 without a call-out, Di Schicht 8:00 – no finding, 0:00", () => {
    const eingabe = {
      rufdienste: [{ ...spanne(uhr(MO, "18:00"), uhr(DI, "6:00")), reaktionMinuten: 60 }],
    };
    expect(mitBereitschaft(diSchicht(), eingabe).map((tag) => tag.tag)).toEqual(["2026-11-17"]);
    expect(pruefe(diSchicht(), eingabe)).toEqual({ befunde: [], nichtHinterlegt: [] });
  });

  it("Grenze: Einsatz Mo 20:00 – 21:00, Di Schicht 8:00 (11:00 Ruhe) – 1:00 Arbeitszeit, no finding", () => {
    const eingabe = einsatz(uhr(MO, "20:00"), uhr(MO, "21:00"));
    const [mo] = mitBereitschaft(diSchicht(), eingabe);
    expect(mo).toMatchObject({ tag: "2026-11-16", arbeitsMinuten: 60, einsatzMinuten: 60 });
    expect(pruefe(diSchicht(), eingabe).befunde).toEqual([]);
  });

  it("Verstoß: Einsatz Mo 23:00 – Di 0:30, Di Schicht 8:00 (7:30 Ruhe) – „Ruhezeit durch Einsatz unterbrochen“", () => {
    // as stamped, Di 8:00 goes on the call-out's shift of Mo (R-29); the rest after it still counts
    const eingabe = einsatz(uhr(MO, "23:00"), uhr(DI, "0:30"));
    expect(pruefe(diSchicht(), eingabe).befunde).toEqual([
      {
        regel: "R-12",
        norm: "§ 5 Abs. 1 ArbZG",
        schwere: "verstoss",
        art: "ruhezeit_durch_einsatz_unterbrochen",
        tage: ["2026-11-16"],
        ruhe: { beginn: um(uhr(DI, "0:30")), ende: um(uhr(DI, "8:00")), minuten: 450 },
        mindestens: 660,
        fehlt: 210,
        einsatz: { beginn: um(uhr(MO, "23:00")), ende: um(uhr(DI, "0:30")), minuten: 90 },
      },
    ]);
  });

  it("Matzak: reaction time 8 min, 18:00 – 6:00 – 12:00 Arbeitszeit, R-02 reports a Verstoß", () => {
    const eingabe = {
      rufdienste: [{ ...spanne(uhr(MO, "18:00"), uhr(DI, "6:00")), reaktionMinuten: 8 }],
    };
    const [mo] = mitBereitschaft([], eingabe);
    // working time for every limit, but no Bereitschaftsdienst for § 7 Abs. 1 Nr. 1 Buchst. a
    expect(mo).toMatchObject({
      arbeitsMinuten: 720,
      bereitschaftsMinuten: 720,
      bereitschaftsdienstMinuten: 0,
    });
    expect(pruefe([], eingabe).befunde).toContainEqual(
      expect.objectContaining({ regel: "R-02", art: "ueber_10h", minuten: 720, ueber: 120 }),
    );
  });

  describe("Matzak mit Tarif: § 7 Abs. 1 Nr. 1 Buchst. a ArbZG names only Arbeitsbereitschaft and Bereitschaftsdienst", () => {
    // a Rufbereitschaft that counts fully is working time for every limit, but no
    // Bereitschaftsdienst: it does not open the agreement (docs/plan.md, Entscheidungen)
    const TARIF = { tarif: { fundstelle: "TV-Ärzte/VKA § 10 Abs. 1" } };
    const tageslimit = (ergebnis: ReturnType<typeof pruefe>) =>
      kurz(ergebnis).filter(([regel]) => regel === "R-02" || regel === "R-11");

    it("reaction time 8 min or none, 18:00 – 6:00 with an agreement – Verstoß of R-02 stays", () => {
      for (const dienst of [{ reaktionMinuten: 8 }, {}]) {
        const ruf = { ...spanne(uhr(MO, "18:00"), uhr(DI, "6:00")), ...dienst };
        expect(tageslimit(pruefe([], { rufdienste: [ruf] }, TARIF))).toEqual([
          ["R-02", "ueber_10h", ["2026-11-16"]],
        ]);
      }
    });

    it("Bereitschaftsdienst 17:00 – 18:00 before it opens the agreement – Hinweis of R-11", () => {
      const eingabe = {
        bereitschaftsdienste: [spanne(uhr(MO, "17:00"), uhr(MO, "18:00"))],
        rufdienste: [{ ...spanne(uhr(MO, "18:00"), uhr(DI, "6:00")), reaktionMinuten: 8 }],
      };
      const [mo] = mitBereitschaft([], eingabe);
      expect(mo).toMatchObject({
        arbeitsMinuten: 780,
        bereitschaftsMinuten: 780,
        bereitschaftsdienstMinuten: 60,
      });
      expect(tageslimit(pruefe([], eingabe, TARIF))).toEqual([
        ["R-11", "ueber_10h_tarif", ["2026-11-16"]],
      ]);
    });
  });

  it("Matzak, Grenze: reaction time 30 min, 18:00 – 6:00 without a call-out – 0:00, no finding", () => {
    const eingabe = {
      rufdienste: [{ ...spanne(uhr(MO, "18:00"), uhr(DI, "6:00")), reaktionMinuten: 30 }],
    };
    expect(mitBereitschaft([], eingabe)).toEqual([]);
    expect(pruefe([], eingabe)).toEqual({ befunde: [], nichtHinterlegt: [] });
  });

  it("ohne Reaktionszeit: Rufbereitschaft 18:00 – 6:00 without a reaction time – 12:00 as with Matzak", () => {
    const eingabe = { rufdienste: [spanne(uhr(MO, "18:00"), uhr(DI, "6:00"))] };
    expect(mitBereitschaft([], eingabe)[0]).toMatchObject({ arbeitsMinuten: 720 });
  });

  it("Matzak: a call-out within a duty that counts fully is no call-out of its own", () => {
    const eingabe = {
      rufdienste: [{ ...spanne(uhr(MO, "18:00"), uhr(DI, "6:00")), reaktionMinuten: 8 }],
      ...einsatz(uhr(MO, "23:00"), uhr(DI, "0:30")),
    };
    expect(mitBereitschaft([], eingabe)[0]).toMatchObject({
      arbeitsMinuten: 720,
      einsatzMinuten: 0,
    });
  });

  it("Einsatz in der Nacht: Mo 12:00 – 18:00, Einsatz Di 3:00 – 4:00, Di Schicht 8:00 – Verstoß for Di only", () => {
    const stempel = [...schicht(uhr(MO, "12:00"), uhr(MO, "18:00")), ...diSchicht()];
    const eingabe = einsatz(uhr(DI, "3:00"), uhr(DI, "4:00"));
    const tage = mitBereitschaft(stempel, eingabe);
    expect(tage.map(({ tag, arbeitsMinuten }) => [tag, arbeitsMinuten])).toEqual([
      ["2026-11-16", 360],
      ["2026-11-17", 420],
    ]);
    const ergebnis = pruefe(stempel, eingabe);
    expect(kurz(ergebnis)).toEqual([
      ["R-12", "ruhezeit_durch_einsatz_unterbrochen", ["2026-11-17"]],
    ]);
    expect(ergebnis.befunde[0]).toMatchObject({ ruhe: { minuten: 240 }, fehlt: 420 });
  });

  it("zwei Einsätze: Mo 22:00 – 23:00 and Di 2:00 – 3:00, Di Schicht 14:00 (11:00) – 2:00 on Mo, no finding", () => {
    const eingabe = {
      einsaetze: [
        spanne(uhr(MO, "22:00"), uhr(MO, "23:00")),
        spanne(uhr(DI, "2:00"), uhr(DI, "3:00")),
      ],
    };
    const stempel = diSchicht("14:00", "18:00");
    expect(mitBereitschaft(stempel, eingabe)[0]).toMatchObject({
      tag: "2026-11-16",
      arbeitsMinuten: 120,
      einsatzMinuten: 120,
    });
    expect(pruefe(stempel, eingabe).befunde).toEqual([]);
  });

  it("zwei Einsätze, Verstoß: Mo 22:00 – 23:00 and Di 3:00 – 4:00, Di Schicht 14:00 (10:00) – Verstoß", () => {
    const eingabe = {
      einsaetze: [
        spanne(uhr(MO, "22:00"), uhr(MO, "23:00")),
        spanne(uhr(DI, "3:00"), uhr(DI, "4:00")),
      ],
    };
    const ergebnis = pruefe(diSchicht("14:00", "18:00"), eingabe);
    expect(ergebnis.befunde).toMatchObject([
      {
        regel: "R-12",
        art: "ruhezeit_durch_einsatz_unterbrochen",
        tage: ["2026-11-16", "2026-11-17"],
        ruhe: { minuten: 600 },
        einsatz: { beginn: um(uhr(DI, "3:00")), minuten: 60 },
      },
    ]);
  });

  it("Gastronomie: Einsatz Mo 23:00 – Di 0:30, Di Schicht 10:30 (10:00) – Hinweis of R-05", () => {
    const eingabe = einsatz(uhr(MO, "23:00"), uhr(DI, "0:30"));
    const ergebnis = pruefe(diSchicht("10:30", "16:30"), eingabe, {
      branche: "gastronomie_beherbergung",
      jetzt: um(uhr(DI, "20:00")),
    });
    expect(ergebnis.befunde).toMatchObject([
      { regel: "R-05", art: "ruhezeit_verkuerzt", schwere: "hinweis", ausgleichBis: "2026-12-14" },
    ]);
  });

  it("Krankenhaus: Mo bis 20:00, Einsatz Mo 23:00 – Di 1:00, Di Schicht 8:00 – Hinweis „Einsatz ausgleichen 2:00“", () => {
    const stempel = [...schicht(uhr(MO, "18:00"), uhr(MO, "20:00")), ...diSchicht()];
    const eingabe = einsatz(uhr(MO, "23:00"), uhr(DI, "1:00"));
    // as stamped, Mo 18:00 to Di 14:00 is one shift of Mo (R-29): 10 h in its Werktag (R-02)
    expect(pruefe(stempel, eingabe, KRANKENHAUS).befunde).toEqual([
      {
        regel: "R-02",
        norm: "§ 3 Satz 2 ArbZG",
        schwere: "hinweis",
        art: "ueber_8h",
        tage: ["2026-11-16"],
        minuten: 600,
        ueber: 120,
      },
      {
        regel: "R-12",
        norm: "§ 5 Abs. 3 ArbZG",
        schwere: "hinweis",
        art: "einsatz_ausgleich",
        tage: ["2026-11-16"],
        einsaetze: [{ beginn: um(uhr(MO, "23:00")), ende: um(uhr(DI, "1:00")), minuten: 120 }],
        minuten: 120,
      },
    ]);
    // anywhere else the call-out interrupts the rest
    expect(kurz(pruefe(stempel, eingabe))).toEqual([
      ["R-02", "ueber_8h", ["2026-11-16"]],
      ["R-12", "ruhezeit_durch_einsatz_unterbrochen", ["2026-11-16"]],
    ]);
  });

  it("Krankenhaus, Grenze: Einsatz Mo 22:00 – Di 3:30 (5:30) – Hinweis „Einsatz ausgleichen 5:30“", () => {
    const stempel = [...schicht(uhr(MO, "18:00"), uhr(MO, "20:00")), ...diSchicht()];
    const ergebnis = pruefe(stempel, einsatz(uhr(MO, "22:00"), uhr(DI, "3:30")), KRANKENHAUS);
    // one shift of Mo as stamped (R-29): 13:30 in its Werktag, a Verstoß of R-02
    expect(kurz(ergebnis)).toEqual([
      ["R-02", "ueber_10h", ["2026-11-16"]],
      ["R-12", "einsatz_ausgleich", ["2026-11-16"]],
    ]);
    expect(ergebnis.befunde[1]).toMatchObject({ minuten: 330 });
  });

  it("Krankenhaus, über die Hälfte: Einsatz Mo 22:00 – Di 3:31 (5:31) – Verstoß (4:29 Ruhe)", () => {
    const stempel = [...schicht(uhr(MO, "18:00"), uhr(MO, "20:00")), ...diSchicht()];
    const ergebnis = pruefe(stempel, einsatz(uhr(MO, "22:00"), uhr(DI, "3:31")), KRANKENHAUS);
    expect(ergebnis.befunde).toMatchObject([
      { regel: "R-02", art: "ueber_10h", minuten: 811 },
      {
        regel: "R-12",
        norm: "§ 5 Abs. 2 ArbZG",
        art: "ruhezeit_durch_einsatz_unterbrochen",
        ruhe: { minuten: 269 },
        mindestens: 600,
        fehlt: 331,
      },
    ]);
  });

  it("Krankenhaus: the call-outs of the rest still running are to be balanced as well", () => {
    const stempel = schicht(uhr(MO, "18:00"), uhr(MO, "20:00"));
    const ergebnis = pruefe(stempel, einsatz(uhr(MO, "23:00"), uhr(DI, "1:00")), {
      ...KRANKENHAUS,
      jetzt: um(uhr(DI, "6:00")),
    });
    expect(kurz(ergebnis)).toEqual([["R-12", "einsatz_ausgleich", ["2026-11-16"]]]);
  });

  it("selber Tag: Mo 5:00 – 9:00, Einsatz Mo 12:00 – 13:00, Mo Schicht 18:30 (5:30 Ruhe) – Verstoß", () => {
    // the shift at 18:30 begins 9:30 after other work, so it is a shift of its own on the same
    // calendar day; the rest after the call-out before it is measured all the same
    const stempel = [
      ...schicht(uhr(MO, "5:00"), uhr(MO, "9:00")),
      ...schicht(uhr(MO, "18:30"), uhr(MO, "22:00")),
    ];
    const ergebnis = pruefe(stempel, einsatz(uhr(MO, "12:00"), uhr(MO, "13:00")));
    expect(ergebnis.befunde.filter((befund) => befund.regel === "R-12")).toEqual([
      {
        regel: "R-12",
        norm: "§ 5 Abs. 1 ArbZG",
        schwere: "verstoss",
        art: "ruhezeit_durch_einsatz_unterbrochen",
        tage: ["2026-11-16"],
        ruhe: { beginn: um(uhr(MO, "13:00")), ende: um(uhr(MO, "18:30")), minuten: 330 },
        mindestens: 660,
        fehlt: 330,
        einsatz: { beginn: um(uhr(MO, "12:00")), ende: um(uhr(MO, "13:00")), minuten: 60 },
      },
    ]);
  });

  it("Krankenhaus, selber Tag: the same call-out is to be balanced – Hinweis „Einsatz ausgleichen 1:00“", () => {
    const stempel = [
      ...schicht(uhr(MO, "5:00"), uhr(MO, "9:00")),
      ...schicht(uhr(MO, "18:30"), uhr(MO, "22:00")),
    ];
    const ergebnis = pruefe(stempel, einsatz(uhr(MO, "12:00"), uhr(MO, "13:00")), KRANKENHAUS);
    expect(ergebnis.befunde.filter((befund) => befund.regel === "R-12")).toMatchObject([
      { art: "einsatz_ausgleich", tage: ["2026-11-16"], minuten: 60 },
    ]);
  });

  it("Herbst: Einsatz Sa 24.10.2026 23:00 – So 0:30, So Schicht 10:30 (11:00 real time) – no finding", () => {
    const eingabe = einsatz("2026-10-24T23:00+02:00", "2026-10-25T00:30+02:00");
    const stempel = schicht("2026-10-25T10:30+01:00", "2026-10-25T14:30+01:00");
    expect(pruefe(stempel, eingabe).befunde).toEqual([]);
  });

  it("Frühjahr: Einsatz Sa 27.03.2027 23:00 – So 0:30, So Schicht 11:00 (9:30 real time) – Verstoß", () => {
    const eingabe = einsatz("2027-03-27T23:00+01:00", "2027-03-28T00:30+01:00");
    const stempel = schicht("2027-03-28T11:00+02:00", "2027-03-28T15:00+02:00");
    expect(pruefe(stempel, eingabe).befunde).toMatchObject([
      {
        regel: "R-12",
        art: "ruhezeit_durch_einsatz_unterbrochen",
        tage: ["2027-03-27", "2027-03-28"],
        ruhe: { minuten: 570 },
      },
    ]);
  });

  it("§ 5 Abs. 3 on a day over 12 h: a call-out in the rest between two shifts of the day stays free – § 7 Abs. 9 wants only the rest after the day's end", () => {
    // § 7 Abs. 9 ArbZG: „im unmittelbaren Anschluss an die Beendigung der Arbeitszeit“; the rest
    // 6:00 – 17:00 lies before the day's work ends at 23:45, so § 5 Abs. 3 still applies to it
    const stempel = [
      ...schicht(uhr(MO, "0:00"), uhr(MO, "6:00")),
      ...schicht(uhr(MO, "17:00"), uhr(MO, "23:00")),
      ...diSchicht("12:00", "14:00"),
    ];
    const eingabe = {
      einsaetze: [spanne(uhr(MO, "10:00"), uhr(MO, "11:00"))],
      bereitschaftsdienste: [spanne(uhr(MO, "23:15"), uhr(MO, "23:45"))],
    };
    const optionen = { ...KRANKENHAUS, tarif: { fundstelle: "TV-Ärzte/VKA § 10 Abs. 1" } };
    const ruhen = kurz(pruefe(stempel, eingabe, optionen)).filter(
      ([regel]) => regel === "R-12" || regel === "R-05" || regel === "R-11",
    );
    expect(ruhen).toEqual([
      ["R-11", "ueber_10h_tarif", ["2026-11-16"]],
      ["R-12", "einsatz_ausgleich", ["2026-11-16"]],
    ]);
  });

  it("Krankenhaus, Einsatz nach über 12 h: Mo 7:00 – 14:00 + Bereitschaftsdienst 14:00 – 20:00, Einsatz Di 6:00 – 7:00 (own shift), Di Schicht 17:00 – Verstoß „Ruhezeit nach über 12 h“ for the 10:00 up to the call-out", () => {
    // § 7 Abs. 9 ArbZG: 11 hours „im unmittelbaren Anschluss an die Beendigung der Arbeitszeit“;
    // the call-out at 6:00 (a shift of its own, 10 h after 20:00) ends that rest after 10:00, so the
    // shortening of § 5 Abs. 2 for the rest after it does not save the day
    const stempel = [...schicht(uhr(MO, "7:00"), uhr(MO, "14:00")), ...diSchicht("17:00", "22:00")];
    const eingabe = {
      einsaetze: [spanne(uhr(DI, "6:00"), uhr(DI, "7:00"))],
      bereitschaftsdienste: [spanne(uhr(MO, "14:00"), uhr(MO, "20:00"))],
    };
    const optionen = { ...KRANKENHAUS, tarif: { fundstelle: "TV-Ärzte/VKA § 10 Abs. 1" } };
    const ruhen = pruefe(stempel, eingabe, optionen).befunde.filter(
      (befund) => befund.regel !== "R-04" && befund.art !== "ueber_10h_tarif",
    );
    expect(ruhen).toEqual([
      {
        regel: "R-11",
        norm: "§ 7 Abs. 9 ArbZG",
        schwere: "verstoss",
        art: "ruhezeit_nach_ueber_12h",
        tage: ["2026-11-16", "2026-11-17"],
        ruhe: { beginn: um(uhr(MO, "20:00")), ende: um(uhr(DI, "6:00")), minuten: 600 },
        mindestens: 660,
        fehlt: 60,
        fundstelle: "TV-Ärzte/VKA § 10 Abs. 1",
      },
    ]);
  });
});

/** Findings of the independent review of PR #100 (optional automatic break deduction) */
import { pdfText } from "@soll/export";
import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";
import { dateiText, exportPfad, PFAD, ZUORDNUNG } from "./datev-testhilfen.ts";
import {
  abgeschlossen,
  abschliessen,
  bestaetigen,
  JETZT,
  type Json,
  json,
  nachtrag,
  pruefen,
  um,
  weber,
} from "./monat-testhilfen.ts";

describe("automatic break deduction: month confirmation and Prüfwert", () => {
  it("invalidates a person's confirmation when switching to a model with the same Soll but pausenabzug enabled", async () => {
    const { jonas, sandra, tag } = await weber();
    // 7:30 without break on 8 October -> 450 min without deduction, 420 min with deduction
    await tag(sandra, [
      ["kommen", "2026-10-08T08:00:00+02:00"],
      ["gehen", "2026-10-08T15:30:00+02:00"],
    ]);
    expect((await bestaetigen(sandra)).status).toBe(201);
    const vor = await json(await sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect((vor.inhalt as Json).summen).toMatchObject({ istMinuten: 480 + 360 + 450 });
    expect(vor.bestaetigung).toMatchObject({ gueltig: true });

    // Owner assigns a model with identical weekday Soll, only pausenabzug: true
    const mitAbzug = await json(
      await jonas.anfrage("/api/v1/arbeitszeit/modelle", {
        body: {
          name: "Vollzeit mit Pausenabzug",
          sollMinuten: [480, 480, 480, 480, 480, 0, 0],
          lohnArt: "monat",
          lohnCent: null,
          minijob: false,
          pausenabzug: true,
          gueltigAb: "2026-01-01",
        },
      }),
    );
    expect(
      (
        await jonas.anfrage(`/api/v1/arbeitszeit/personen/${sandra.nutzerId}/modell`, {
          method: "PUT",
          body: { modellId: mitAbzug.modellId, gueltigAb: "2026-10-01" },
        })
      ).status,
    ).toBe(200);

    const nach = await json(await sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect((nach.inhalt as Json).summen).toMatchObject({
      istMinuten: 480 + 360 + 420,
      pausenabzugMinuten: 30,
    });
    // Sandra confirmed 450 min on 8 Oct, not 420 min: her confirmation must no longer hold
    expect(nach.bestaetigung).toMatchObject({ gueltig: false });
    expect((await abschliessen(jonas, sandra.nutzerId)).status).toBe(409);
  });

  it("reports a Prüfwert Abweichung when arbeitszeitmodelle.pausenabzug is altered past the audit chain", async () => {
    const { server, jonas, pruefwert } = await abgeschlossen();
    server.sqlite.query("UPDATE arbeitszeitmodelle SET pausenabzug = 1").run();
    const ergebnis = await pruefen(server, jonas.betriebId, pruefwert);
    expect(ergebnis.ergebnis).toBe("abweichung");
  });
});

describe("automatic break deduction: DATEV payroll export and PDF time sheet", () => {
  const stundenModellMitAbzug = async () => {
    const server = testServer();
    server.stelleUhr(JETZT);
    const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const sandra = await server.eingeladen(jonas, "mitarbeiter", "sandra");
    const lohn = await server.eingeladen(jonas, "lohnbuero", "lohnbuero");
    await jonas.anfrage("/api/v1/standorte", { body: { name: "Werkstatt", land: "HH" } });
    const modell = await json(
      await jonas.anfrage("/api/v1/arbeitszeit/modelle", {
        body: {
          name: "Stundenlohn Auto-Pause",
          sollMinuten: [480, 480, 480, 480, 480, 0, 0],
          lohnArt: "stunde",
          lohnCent: 2000,
          minijob: false,
          pausenabzug: true,
          gueltigAb: "2026-01-01",
        },
      }),
    );
    await jonas.anfrage(`/api/v1/arbeitszeit/personen/${sandra.nutzerId}/modell`, {
      method: "PUT",
      body: { modellId: modell.modellId, gueltigAb: "2026-10-01" },
    });
    // 7:30 worked without stamped break -> 30 min automatic deduction -> 7:00 net
    for (const [art, zeit] of [
      ["kommen", "2026-10-06T08:00:00+02:00"],
      ["gehen", "2026-10-06T15:30:00+02:00"],
    ] as const) {
      expect((await nachtrag(sandra, { art, zeitpunkt: um(zeit), grund: "Zettel" })).status).toBe(
        201,
      );
    }
    expect((await bestaetigen(sandra)).status).toBe(201);
    const geschlossen = await abschliessen(jonas, sandra.nutzerId);
    expect(geschlossen.status).toBe(201);
    const daten = await json(geschlossen);
    expect((daten.inhalt as Json).summen).toMatchObject({
      gearbeitetMinuten: 420,
      istMinuten: 420,
      pausenabzugMinuten: 30,
    });
    return { server, jonas, sandra, lohn };
  };

  it("exports net worked hours after automatic break deduction to DATEV, matching the closed month", async () => {
    const { jonas, sandra, lohn } = await stundenModellMitAbzug();
    expect(
      (
        await jonas.anfrage(PFAD, {
          method: "PUT",
          body: { ...ZUORDNUNG, personalnummern: { [sandra.nutzerId]: "101" } },
        })
      ).status,
    ).toBe(200);
    const antwort = await lohn.anfrage(exportPfad("2026-10", "lodas"));
    expect(antwort.status).toBe(200);
    // Closed month has 7:00 worked (420 min after 30 min automatic deduction), not 7,50
    expect(await dateiText(antwort)).toContain("1;01.10.2026;101;1000;1;7,00;");
  });

  it("shows automatic break deduction transparently on the PDF Stundenzettel", async () => {
    const { sandra } = await stundenModellMitAbzug();
    const antwort = await sandra.anfrage("/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-10");
    expect(antwort.status).toBe(200);
    const text = pdfText(new Uint8Array(await antwort.arrayBuffer()));
    expect(text).toContain("Ist 7:00");
    expect(text).toMatch(/Pausenabzug|automatisch/i);
  });
});

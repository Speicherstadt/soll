import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";
import { dateiText, exportPfad, PFAD, weberMitOktober, ZUORDNUNG } from "./datev-testhilfen.ts";
import { json } from "./monat-testhilfen.ts";

const LODAS_OKTOBER = [
  "[Allgemein]",
  "Ziel=LODAS",
  "Version_SST=1.0",
  "BeraterNr=1234567",
  "MandantenNr=10001",
  "Feldtrennzeichen=;",
  "Zahlenkomma=,",
  "Datumsformat=TT.MM.JJJJ",
  "",
  "[Satzbeschreibung]",
  "1;u_lod_bwd_buchung_standard;abrechnung_zeitraum#bwd;pnr#bwd;la_eigene#bwd;bs_nr#bwd;bs_wert_butab#bwd;",
  "",
  "[Bewegungsdaten]",
  // 4 h on Sunday and 8 h on Tuesday; 50 % of 21,50 € for 4 h, all tax-free (§ 3b EStG)
  "1;01.10.2026;101;1000;1;12,00;",
  "1;01.10.2026;101;1310;2;43,00;",
  "",
].join("\r\n");

describe("the DATEV export of a closed month", () => {
  it("gives the LODAS file of the closed October to payroll, as Windows-1252 text", async () => {
    const w = await weberMitOktober();
    expect((await w.zuordnung()).status).toBe(200);
    const antwort = await w.lohn.anfrage(exportPfad("2026-10", "lodas"));
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("content-type")).toBe("text/plain; charset=windows-1252");
    expect(antwort.headers.get("content-disposition")).toBe(
      'attachment; filename="DATEV_LODAS_2026-10.txt"',
    );
    expect(await dateiText(antwort)).toBe(LODAS_OKTOBER);
  });

  it("gives the Lohn und Gehalt file to the owner", async () => {
    const w = await weberMitOktober();
    await w.zuordnung();
    const antwort = await w.jonas.anfrage(exportPfad("2026-10", "lug"));
    expect(antwort.status).toBe(200);
    expect(await dateiText(antwort)).toBe("101;;;1000;12,00;;;;;;\r\n101;;;1310;;;43,00;;;;\r\n");
  });

  it('lists everything that is "nicht hinterlegt" at once, with the person\'s name', async () => {
    const w = await weberMitOktober();
    const antwort = await w.lohn.anfrage(exportPfad("2026-10", "lodas"));
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({
      fehler: "nicht_hinterlegt",
      fehlend: [
        { art: "beraternummer" },
        { art: "mandantennummer" },
        { art: "personalnummer", nutzerId: w.sandra.nutzerId, name: "sandra" },
        { art: "lohnart", posten: "stunden" },
        { art: "lohnart", posten: "sonntag_steuerfrei" },
      ],
    });
  });

  it("refuses while a person with a model has not had the month closed", async () => {
    const w = await weberMitOktober();
    await w.zuordnung();
    await w.zuordnen(w.anna.nutzerId);
    const antwort = await w.lohn.anfrage(exportPfad("2026-10", "lodas"));
    expect(antwort.status).toBe(409);
    expect((await json(antwort)).fehlend).toEqual([
      { art: "monat_offen", nutzerId: w.anna.nutzerId, name: "anna" },
    ]);
  });

  it("gives the same file after a counter-entry booked in a later month", async () => {
    const w = await weberMitOktober();
    await w.zuordnung();
    const vorher = await dateiText(await w.lohn.anfrage(exportPfad("2026-10", "lodas")));
    const gegen = await w.jonas.anfrage("/api/v1/arbeitszeit/monat/gegeneintrag", {
      body: { nutzerId: w.sandra.nutzerId, tag: "2026-10-06", minuten: 30, grund: "Fahrt" },
    });
    expect(gegen.status).toBe(201);
    expect(await dateiText(await w.lohn.anfrage(exportPfad("2026-10", "lodas")))).toBe(vorher);
  });

  it("refuses a month or a target it does not know", async () => {
    const w = await weberMitOktober();
    for (const pfad of [exportPfad("2026-13", "lodas"), exportPfad("2026-10", "csv")])
      expect((await w.lohn.anfrage(pfad)).status, pfad).toBe(400);
  });
});

describe("the mapping of the business", () => {
  it("shows the items, the persons and what is set", async () => {
    const w = await weberMitOktober();
    const leer = await json(await w.lohn.anfrage(PFAD));
    expect(leer).toMatchObject({ beraterNr: null, mandantenNr: null, lohnarten: {} });
    expect(leer.postenarten).toContain("sonntag_steuerfrei");
    await w.zuordnung();
    const gesetzt = await json(await w.lohn.anfrage(PFAD));
    expect(gesetzt).toMatchObject(ZUORDNUNG);
    expect(gesetzt.personen).toContainEqual({
      nutzerId: w.sandra.nutzerId,
      name: "sandra",
      personalnummer: "101",
    });
  });

  it("writes every change into the audit chain", async () => {
    const w = await weberMitOktober();
    await w.zuordnung();
    const tabellen = w.server.sqlite
      .query("SELECT tabelle FROM audit_glieder WHERE tabelle LIKE 'datev%' ORDER BY seq")
      .all();
    expect(tabellen).toEqual([
      { tabelle: "datevEinstellungen" },
      { tabelle: "datevPersonalnummern" },
    ]);
  });

  it("refuses numbers of the wrong form and wage types of unknown items", async () => {
    const w = await weberMitOktober();
    for (const mehr of [
      { beraterNr: "123" },
      { mandantenNr: "123456" },
      { lohnarten: { stunden: "12345" } },
      { lohnarten: { gehalt: "1000" } },
      { personalnummern: { [w.sandra.nutzerId]: "P-101" } },
    ])
      expect((await w.zuordnung(mehr)).status, JSON.stringify(mehr)).toBe(400);
  });

  it("gives a personnel number once, lets two people swap and removes one with null", async () => {
    const w = await weberMitOktober();
    await w.zuordnung({
      personalnummern: { [w.sandra.nutzerId]: "101", [w.anna.nutzerId]: "102" },
    });
    const doppelt = await w.zuordnung({ personalnummern: { [w.anna.nutzerId]: "101" } });
    expect(doppelt.status).toBe(409);
    expect(await json(doppelt)).toEqual({ fehler: "doppelt" });
    const getauscht = await w.zuordnung({
      personalnummern: { [w.sandra.nutzerId]: "102", [w.anna.nutzerId]: "101" },
    });
    expect(getauscht.status).toBe(200);
    await w.zuordnung({ personalnummern: { [w.anna.nutzerId]: null } });
    const personen = (await json(await w.lohn.anfrage(PFAD))).personen as {
      nutzerId: string;
      personalnummer: string | null;
    }[];
    const von = (id: string) => personen.find((p) => p.nutzerId === id)?.personalnummer;
    expect([von(w.sandra.nutzerId), von(w.anna.nutzerId)]).toEqual(["102", null]);
  });

  it("refuses a personnel number for someone who is no member", async () => {
    const w = await weberMitOktober();
    expect((await w.zuordnung({ personalnummern: { fremd: "101" } })).status).toBe(404);
  });

  it("is for the owner and payroll only", async () => {
    const w = await weberMitOktober();
    for (const wer of [w.anna, w.sandra])
      for (const [method, pfad, body] of [
        ["GET", PFAD],
        ["PUT", PFAD, { ...ZUORDNUNG, personalnummern: {} }],
        ["GET", exportPfad("2026-10", "lodas")],
      ] as const) {
        const antwort = await wer.anfrage(pfad, { method, body });
        expect(antwort.status, `${method} ${pfad}`).toBe(403);
      }
  });

  it("is refused while working time is switched off", async () => {
    const server = testServer();
    const solo = await server.inhaberMitBetrieb("Solo", "solo");
    await solo.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { arbeitszeit: false } });
    for (const [method, pfad, body] of [
      ["GET", PFAD],
      ["PUT", PFAD, { ...ZUORDNUNG, personalnummern: {} }],
      ["GET", exportPfad("2026-10", "lodas")],
    ] as const) {
      const antwort = await solo.anfrage(pfad, { method, body });
      expect(antwort.status, `${method} ${pfad}`).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
    }
  });
});

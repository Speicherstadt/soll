import { describe, expect, it } from "vitest";
import { genehmigt, weberMitAbwesenheiten } from "./abwesenheit-testhilfen.ts";
import { anpassen, hinweis, type Json, json, konten, um } from "./konten-testhilfen.ts";
import { abschliessen, bestaetigen } from "./monat-testhilfen.ts";

/*
 * The accounts in the app (S-402). Sandra works full time (five days) from 1 October 2026: her
 * leave of 2026 is Teilurlaub under § 5 Abs. 1 Buchst. a BUrlG, 3/12 of 20 days = 5 days, carried
 * into 2027 on request (§ 7 Abs. 3 Satz 4 BUrlG), which Soll assumes. Today is 20 November 2026.
 */

const urlaub = (k: Json) => k.urlaub as Json;
const toepfe = (k: Json) => urlaub(k).toepfe as Json[];

describe("GET /konten: one's own accounts", () => {
  it("shows the leave of the year with when the notice is due and the overtime of no closed month", async () => {
    const { sandra } = await weberMitAbwesenheiten();
    const k = await konten(sandra);
    expect(urlaub(k)).toMatchObject({
      ok: true,
      startJahr: 2026,
      restHalbtage: 10,
      geplantHalbtage: 0,
    });
    expect(toepfe(k)).toEqual([
      {
        jahr: 2026,
        anspruchHalbtage: 10,
        genommenHalbtage: 0,
        verfallenHalbtage: 0,
        restHalbtage: 10,
        verfallstag: "2027-12-31",
        hinweisBis: "2027-09-30",
        hinweis: null,
        verfaelltAm: null,
      },
    ]);
    expect((urlaub(k).befunde as Json[]).map((b) => [b.art, b.tage, b.norm])).toEqual([
      ["hinweis_faellig", ["2027-09-30"], "§ 7 Abs. 3 Satz 4 BUrlG"],
    ]);
    expect(k.ueberstunden).toEqual({ ok: true, saldoMinuten: 0, verlauf: [], luecken: [] });
    expect(k).toMatchObject({ heute: "2026-11-20", hinweise: [], anpassungen: [] });
    expect((k.rechte as Json).pflegen).toBe(false);
  });

  it("names approved leave still to come as planned, not as taken", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, { von: "2026-12-21", bis: "2026-12-22" });
    expect(urlaub(await konten(w.sandra))).toMatchObject({ restHalbtage: 10, geplantHalbtage: 4 });
    w.server.stelleUhr(um("2026-12-23T09:00:00+01:00"));
    expect(urlaub(await konten(w.sandra))).toMatchObject({ restHalbtage: 6, geplantHalbtage: 0 });
  });

  it("takes the overtime from the closed month as it was closed", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    const inhalt = JSON.parse(
      (
        w.server.sqlite
          .query("SELECT inhalt FROM monatsabschluesse WHERE schritt = 'abgeschlossen'")
          .get() as { inhalt: string }
      ).inhalt,
    );
    const saldo = inhalt.summen.istMinuten - inhalt.summen.sollMinuten;
    const u = (await konten(w.sandra)).ueberstunden as Json;
    expect(u).toMatchObject({ ok: true, saldoMinuten: saldo, luecken: [] });
    expect(u.verlauf).toEqual([
      { monat: "2026-10", differenzMinuten: saldo, anpassungMinuten: 0, saldoMinuten: saldo },
    ]);
  });
});

describe("POST /konten/:nutzerId/hinweise: the day of the notice on leave expiring", () => {
  it("records the day with what it named and lets the leave expire from then", async () => {
    const { jonas, sandra } = await weberMitAbwesenheiten();
    const antwort = await hinweis(jonas, sandra, "2026-11-20");
    expect(antwort.status).toBe(201);
    expect(await json(antwort)).toMatchObject({
      tag: "2026-11-20",
      inhalt: [{ jahr: 2026, halbtage: 10, verfaelltAm: "2027-12-31" }],
      erstelltAm: um("2026-11-20T09:00:00+01:00"),
    });
    const k = await konten(sandra);
    expect(toepfe(k)[0]).toMatchObject({ hinweis: "2026-11-20", verfaelltAm: "2027-12-31" });
    expect((urlaub(k).befunde as Json[]).map((b) => b.art)).toEqual(["verfall_droht"]);
    expect((k.hinweise as Json[]).map((h) => [h.tag, h.inhalt])).toEqual([
      ["2026-11-20", [{ jahr: 2026, halbtage: 10, verfaelltAm: "2027-12-31" }]],
    ]);
  });

  it("takes a day before today for a notice given outside Soll", async () => {
    const { jonas, sandra } = await weberMitAbwesenheiten();
    expect((await hinweis(jonas, sandra, "2026-10-15")).status).toBe(201);
    expect(toepfe(await konten(sandra))[0]).toMatchObject({ hinweis: "2026-10-15" });
  });

  it("refuses a day after today, before the account begins, and a second on the same day", async () => {
    const { jonas, sandra, server } = await weberMitAbwesenheiten();
    for (const [tag, status, fehler] of [
      ["2026-11-21", 422, "ungueltig"],
      ["2025-12-31", 422, "ungueltig"],
      ["2026-02-30", 400, "ungueltig"],
    ] as const) {
      const antwort = await hinweis(jonas, sandra, tag);
      expect(antwort.status, tag).toBe(status);
      expect(await json(antwort)).toEqual({ fehler });
    }
    expect((await hinweis(jonas, sandra, "2026-11-20")).status).toBe(201);
    const zweiter = await hinweis(jonas, sandra, "2026-11-20");
    expect(zweiter.status).toBe(409);
    expect(await json(zweiter)).toEqual({ fehler: "vorhanden" });
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM urlaubshinweise").get()).toEqual({
      n: 1,
    });
  });

  it("is the owner's: planner, payroll and the person are refused", async () => {
    const { anna, lohn, sandra, server } = await weberMitAbwesenheiten();
    for (const wer of [anna, lohn, sandra]) {
      const antwort = await hinweis(wer, sandra, "2026-11-20");
      expect(antwort.status).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "keine_berechtigung" });
    }
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM urlaubshinweise").get()).toEqual({
      n: 0,
    });
  });
});

describe("POST /konten/:nutzerId/anpassungen: changes by hand", () => {
  it("adds a start balance, a payout and a correction to the overtime account", async () => {
    const { jonas, sandra } = await weberMitAbwesenheiten();
    for (const body of [
      { art: "startsaldo", monat: "2026-10", minuten: 600 },
      { art: "auszahlung", monat: "2026-11", minuten: 120 },
      { art: "korrektur", monat: "2026-11", minuten: -30 },
    ])
      expect((await anpassen(jonas, sandra, body)).status).toBe(201);
    const k = await konten(sandra);
    expect(k.ueberstunden).toMatchObject({ ok: true, saldoMinuten: 450 });
    expect((k.anpassungen as Json[]).map((a) => [a.art, a.monat, a.minuten, a.grund])).toEqual([
      ["startsaldo", "2026-10", 600, "Übernahme"],
      ["auszahlung", "2026-11", 120, "Übernahme"],
      ["korrektur", "2026-11", -30, "Übernahme"],
    ]);
  });

  it("refuses a second start balance and one after a closed month", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    const danach = await anpassen(w.jonas, w.sandra, {
      art: "startsaldo",
      monat: "2026-11",
      minuten: 60,
    });
    expect(danach.status).toBe(409);
    expect(await json(danach)).toEqual({ fehler: "widerspruch" });
    // in the closed month itself neither: its content and Prüfwert would not hold it (S-708)
    const darin = await anpassen(w.jonas, w.sandra, {
      art: "startsaldo",
      monat: "2026-10",
      minuten: 60,
    });
    expect(darin.status).toBe(409);
    expect(await json(darin)).toEqual({ fehler: "widerspruch" });
  });

  it("refuses a second start balance", async () => {
    const w = await weberMitAbwesenheiten();
    const start = { art: "startsaldo", monat: "2026-10", minuten: 60 };
    expect((await anpassen(w.jonas, w.sandra, start)).status).toBe(201);
    const zweiter = await anpassen(w.jonas, w.sandra, start);
    expect(zweiter.status).toBe(409);
    expect(await json(zweiter)).toEqual({ fehler: "vorhanden" });
  });

  it("brings in leave from before Soll as leave of the year before, and corrects a year", async () => {
    const { jonas, sandra } = await weberMitAbwesenheiten();
    expect(
      (await anpassen(jonas, sandra, { art: "urlaub_start", jahr: 2026, halbtage: 6 })).status,
    ).toBe(201);
    expect(
      (await anpassen(jonas, sandra, { art: "urlaub_korrektur", jahr: 2026, halbtage: -2 })).status,
    ).toBe(201);
    const k = await konten(sandra);
    expect(urlaub(k)).toMatchObject({ startJahr: 2026, restHalbtage: 14 });
    expect(toepfe(k).map((t) => [t.jahr, t.restHalbtage, t.verfallstag])).toEqual([
      [2025, 6, "2026-03-31"],
      [2026, 8, "2027-12-31"],
    ]);
    const zweiter = await anpassen(jonas, sandra, { art: "urlaub_start", jahr: 2026, halbtage: 2 });
    expect(zweiter.status).toBe(409);
  });

  it("refuses what is no change: a payout of nothing or less, a correction of nothing, no reason", async () => {
    const { jonas, sandra, server } = await weberMitAbwesenheiten();
    for (const body of [
      { art: "auszahlung", monat: "2026-11", minuten: 0 },
      { art: "auszahlung", monat: "2026-11", minuten: -60 },
      { art: "korrektur", monat: "2026-11", minuten: 0 },
      { art: "urlaub_korrektur", jahr: 2026, halbtage: 0 },
      { art: "startsaldo", monat: "2026-13", minuten: 60 },
      { art: "startsaldo", monat: "2026-11", minuten: 1.5 },
      { art: "startsaldo", monat: "2026-11", minuten: 60, grund: " " },
      { art: "urlaub_start", jahr: 2026, halbtage: -2 },
    ])
      expect((await anpassen(jonas, sandra, body)).status, JSON.stringify(body)).toBe(400);
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM konto_anpassungen").get()).toEqual({
      n: 0,
    });
  });

  it("is the owner's: planner, payroll and the person are refused", async () => {
    const { anna, lohn, sandra } = await weberMitAbwesenheiten();
    for (const wer of [anna, lohn, sandra])
      expect(
        (await anpassen(wer, sandra, { art: "startsaldo", monat: "2026-10", minuten: 60 })).status,
      ).toBe(403);
  });
});

describe("who reads whose accounts", () => {
  it("owner and payroll read everything of a person, a planner only what is left", async () => {
    const w = await weberMitAbwesenheiten();
    await hinweis(w.jonas, w.sandra, "2026-11-20");
    await anpassen(w.jonas, w.sandra, { art: "auszahlung", monat: "2026-11", minuten: 60 });
    const eigen = await konten(w.sandra);
    for (const wer of [w.jonas, w.lohn]) {
      const k = await konten(wer, w.sandra.nutzerId);
      expect(k.urlaub).toEqual(eigen.urlaub);
      expect(k.hinweise).toEqual(eigen.hinweise);
      expect(k.anpassungen).toEqual(eigen.anpassungen);
    }
    // the years with leave taken would tell sickness in leave (§ 9 BUrlG), a payout is payroll's
    const planer = await konten(w.anna, w.sandra.nutzerId);
    expect(planer.urlaub).toEqual({ ok: true, restHalbtage: 10, geplantHalbtage: 0 });
    expect(planer).toMatchObject({ hinweise: [], anpassungen: [] });
    // of the overtime only the balance: the months would show the payout (review S-402)
    const u = eigen.ueberstunden as Json;
    expect(planer.ueberstunden).toEqual({ ok: true, saldoMinuten: u.saldoMinuten, luecken: [] });
  });

  it("refuses another person's accounts to an employee", async () => {
    const { max, sandra } = await weberMitAbwesenheiten();
    const antwort = await max.anfrage(`/api/v1/arbeitszeit/konten?nutzerId=${sandra.nutzerId}`);
    expect(antwort.status).toBe(403);
  });

  it("says „nicht hinterlegt“ when a closed month has no sums, instead of a wrong balance", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    w.server.sqlite.run(
      "UPDATE monatsabschluesse SET inhalt = json_set(inhalt, '$.summen', json('null'))",
    );
    expect((await konten(w.sandra)).ueberstunden).toEqual({
      ok: false,
      grund: "nicht_hinterlegt",
      monate: ["2026-10"],
    });
  });

  it("says „nicht hinterlegt“ for leave without a model (Max has none, Jonas has)", async () => {
    const { jonas, max } = await weberMitAbwesenheiten();
    expect((await konten(jonas)).urlaub).toMatchObject({ ok: true });
    expect((await konten(max)).urlaub).toEqual({
      ok: false,
      grund: "nicht_hinterlegt",
      monate: [],
    });
  });

  it("says „ausgesondert“ once a month of the account was removed after its retention period", async () => {
    const w = await weberMitAbwesenheiten();
    w.server.sqlite.run(
      `INSERT INTO aussonderungen VALUES ('${w.jonas.betriebId}', 'a1', '${w.sandra.nutzerId}', '2026-10', 'x', 2, 0, 0, 0, 0)`,
    );
    const k = await konten(w.sandra);
    expect(k.ueberstunden).toEqual({ ok: false, grund: "ausgesondert", monate: ["2026-10"] });
    expect(k.urlaub).toEqual({ ok: false, grund: "ausgesondert", monate: ["2026-10"] });
  });
});

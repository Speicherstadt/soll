import { describe, expect, it } from "vitest";
import { weberMitAbwesenheiten } from "./abwesenheit-testhilfen.ts";
import { anpassen, hinweis, type Json, json, konten } from "./konten-testhilfen.ts";
import { abschliessen, bestaetigen } from "./monat-testhilfen.ts";

/*
 * Findings of the independent review of S-402. Sandra joined on 1 October 2026 (her model starts
 * then, she stamped on 6 October); today is 20 November 2026.
 */

describe("review S-402: the start balance", () => {
  it("keeps the overtime account computable when a start balance precedes closing an earlier open month", async () => {
    const w = await weberMitAbwesenheiten();
    const start = await anpassen(w.jonas, w.sandra, {
      art: "startsaldo",
      monat: "2026-11",
      minuten: 600,
    });
    expect(start.status).toBe(201);
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    // the start balance stands for everything before its month: October closed later counts not
    const u = (await konten(w.sandra)).ueberstunden as Json;
    expect(u).toMatchObject({ ok: true, saldoMinuten: 600 });
    expect(
      (await anpassen(w.jonas, w.sandra, { art: "auszahlung", monat: "2026-11", minuten: 60 }))
        .status,
    ).toBe(201);
    expect((await konten(w.sandra)).ueberstunden).toMatchObject({ ok: true, saldoMinuten: 540 });
  });
});

describe("review S-402: the notice on leave expiring", () => {
  it("refuses a notice on a day before the person joined: it could not have been given", async () => {
    const { jonas, sandra, server } = await weberMitAbwesenheiten();
    const antwort = await hinweis(jonas, sandra, "2026-01-05");
    expect(antwort.status).toBe(422);
    expect(await json(antwort)).toEqual({ fehler: "ungueltig" });
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM urlaubshinweise").get()).toEqual({
      n: 0,
    });
    // from the day of joining on, it can
    expect((await hinweis(jonas, sandra, "2026-10-01")).status).toBe(201);
  });
});

describe("review S-402: what a planner reads", () => {
  it("does not show a planner another person's payout", async () => {
    const w = await weberMitAbwesenheiten();
    expect(
      (await anpassen(w.jonas, w.sandra, { art: "auszahlung", monat: "2026-11", minuten: 600 }))
        .status,
    ).toBe(201);
    const planer = await konten(w.anna, w.sandra.nutzerId);
    const verlauf = ((planer.ueberstunden as Json).verlauf ?? []) as Json[];
    expect(verlauf.map((m) => m.anpassungMinuten).filter((x) => x !== 0)).toEqual([]);
    // the balance stays, as the planner needs it for Überstundenabbau
    expect(planer.ueberstunden).toEqual({ ok: true, saldoMinuten: -600, luecken: [] });
  });
});

describe("review S-402: plausible years of a change of the leave account", () => {
  it("refuses years before the person joined and after next year", async () => {
    const { jonas, sandra, server } = await weberMitAbwesenheiten();
    for (const body of [
      { art: "urlaub_start", jahr: 2000, halbtage: 4 },
      { art: "urlaub_start", jahr: 2028, halbtage: 4 },
      { art: "urlaub_korrektur", jahr: 2024, halbtage: 2 },
      { art: "urlaub_korrektur", jahr: 2028, halbtage: 2 },
    ]) {
      const antwort = await anpassen(jonas, sandra, body);
      expect(antwort.status, JSON.stringify(body)).toBe(422);
    }
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM konto_anpassungen").get()).toEqual({
      n: 0,
    });
    // the year before the account begins holds the leave brought in, so it may be corrected
    expect(
      (await anpassen(jonas, sandra, { art: "urlaub_korrektur", jahr: 2025, halbtage: 2 })).status,
    ).toBe(201);
    expect(
      (await anpassen(jonas, sandra, { art: "urlaub_start", jahr: 2027, halbtage: 4 })).status,
    ).toBe(201);
  });
});

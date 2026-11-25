import { describe, expect, it } from "vitest";
import { weberMitAbwesenheiten } from "./abwesenheit-testhilfen.ts";
import { anpassen, hinweis, json, konten } from "./konten-testhilfen.ts";
import { abschliessen, bestaetigen } from "./monat-testhilfen.ts";

/* Review S-402, round 2. Sandra joined on 1 October 2026; today is 20 November 2026. */

describe("review 2: a start balance after the current month", () => {
  it("does not let a start balance set ahead silently drop a month closed later", async () => {
    const w = await weberMitAbwesenheiten();
    const start = await anpassen(w.jonas, w.sandra, {
      art: "startsaldo",
      monat: "2027-06",
      minuten: 0,
    });
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    const u = (await konten(w.sandra)).ueberstunden;
    // either the start ahead is refused, or October (closed, Ist − Soll ≠ 0) is in the account
    expect(start.status === 422 || (u as { saldoMinuten: number }).saldoMinuten !== 0).toBe(true);
  });

  it("refuses a start balance before the person joined: else every month since then stands as a gap", async () => {
    const w = await weberMitAbwesenheiten();
    const start = await anpassen(w.jonas, w.sandra, {
      art: "startsaldo",
      monat: "2020-01",
      minuten: 0,
    });
    expect(start.status).toBe(422);
  });
});

describe("review 2: the months of overtime changes", () => {
  it("refuses any change for a month after this one or before joining, takes this month and the joining month", async () => {
    const { jonas, sandra, server } = await weberMitAbwesenheiten();
    for (const body of [
      { art: "startsaldo", monat: "2027-06", minuten: 60 },
      { art: "auszahlung", monat: "2099-12", minuten: 60 },
      { art: "korrektur", monat: "2026-12", minuten: 60 },
      { art: "korrektur", monat: "2026-09", minuten: 60 },
    ]) {
      const antwort = await anpassen(jonas, sandra, body);
      expect(antwort.status, JSON.stringify(body)).toBe(422);
      expect(await json(antwort)).toEqual({ fehler: "ungueltig" });
    }
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM konto_anpassungen").get()).toEqual({
      n: 0,
    });
    expect(
      (await anpassen(jonas, sandra, { art: "startsaldo", monat: "2026-10", minuten: 60 })).status,
    ).toBe(201);
    expect(
      (await anpassen(jonas, sandra, { art: "auszahlung", monat: "2026-11", minuten: 60 })).status,
    ).toBe(201);
  });
});

describe("review 2: a notice before the account begins", () => {
  it("still brings in leave from the year of the earliest notice", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await hinweis(w.jonas, w.sandra, "2026-10-01")).status).toBe(201);
    expect(
      (await anpassen(w.jonas, w.sandra, { art: "urlaub_start", jahr: 2026, halbtage: 4 })).status,
    ).toBe(201);
  });

  it("refuses bringing in leave from a year after a notice already given", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await hinweis(w.jonas, w.sandra, "2026-10-01")).status).toBe(201);
    const start = await anpassen(w.jonas, w.sandra, {
      art: "urlaub_start",
      jahr: 2027,
      halbtage: 4,
    });
    // else the notice of 1 October 2026 lies before the account begins (BAULISTE.md S-402)
    expect(start.status).toBe(409);
    expect(await json(start)).toEqual({ fehler: "widerspruch" });
  });
});

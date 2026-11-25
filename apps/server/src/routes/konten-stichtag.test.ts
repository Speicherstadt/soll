import { describe, expect, it } from "vitest";
import { genehmigt, weberMitAbwesenheiten } from "./abwesenheit-testhilfen.ts";
import { anpassen, hinweis, type Json, json, konten } from "./konten-testhilfen.ts";
import { abschliessen, bestaetigen, pruefen } from "./monat-testhilfen.ts";

/*
 * The balances on a cut-off date by hand (S-708, docs/regeln.md R-34). Sandra works full time from
 * 1 October 2026; today is 20 November 2026.
 */

const urlaub = (k: Json) => k.urlaub as Json;

describe("POST /konten/:nutzerId/anpassungen: leave on a cut-off date", () => {
  it("takes it as all leave open that day: the year's leave and leave before it count no more", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, { von: "2026-10-12", bis: "2026-10-13" });
    await genehmigt(w, w.sandra, { von: "2026-12-21", bis: "2026-12-21" });
    const antwort = await anpassen(w.jonas, w.sandra, {
      art: "urlaub_stichtag",
      monat: "2026-11",
      halbtage: 17,
    });
    expect(antwort.status).toBe(201);
    const k = await konten(w.sandra);
    expect(urlaub(k)).toMatchObject({ ok: true, startJahr: 2026, restHalbtage: 17 });
    expect(urlaub(k).geplantHalbtage).toBe(2);
    expect((urlaub(k).toepfe as Json[]).map((t) => [t.jahr, t.anspruchHalbtage])).toEqual([
      [2026, 17],
    ]);
    expect((k.anpassungen as Json[]).map((a) => [a.art, a.monat, a.halbtage])).toEqual([
      ["urlaub_stichtag", "2026-11", 17],
    ]);
  });

  it("refuses a second start of the leave account, in either form, and negative leave", async () => {
    const w = await weberMitAbwesenheiten();
    const start = { art: "urlaub_stichtag", monat: "2026-11", halbtage: 4 };
    expect((await anpassen(w.jonas, w.sandra, start)).status).toBe(201);
    const zweiter = await anpassen(w.jonas, w.sandra, {
      art: "urlaub_start",
      jahr: 2026,
      halbtage: 2,
    });
    expect(zweiter.status).toBe(409);
    expect(await json(zweiter)).toEqual({ fehler: "vorhanden" });
    expect((await anpassen(w.jonas, w.sandra, start)).status).toBe(409);
    const negativ = await anpassen(w.jonas, w.sandra, { ...start, halbtage: -4 });
    expect(negativ.status).toBe(400);
  });

  it("corrects it with another change, never by overwriting", async () => {
    const w = await weberMitAbwesenheiten();
    await anpassen(w.jonas, w.sandra, { art: "urlaub_stichtag", monat: "2026-11", halbtage: 17 });
    const korrektur = { art: "urlaub_korrektur", jahr: 2026, halbtage: -2 };
    expect((await anpassen(w.jonas, w.sandra, korrektur)).status).toBe(201);
    expect(urlaub(await konten(w.sandra)).restHalbtage).toBe(15);
  });

  it("refuses a cut-off date after a notice on leave expiring, as the notice named other leave", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await hinweis(w.jonas, w.sandra, "2026-10-15")).status).toBe(201);
    const antwort = await anpassen(w.jonas, w.sandra, {
      art: "urlaub_stichtag",
      monat: "2026-11",
      halbtage: 4,
    });
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "widerspruch" });
  });

  it("refuses a cut-off date in or after a closed month", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    for (const monat of ["2026-10", "2026-11"]) {
      const antwort = await anpassen(w.jonas, w.sandra, {
        art: "urlaub_stichtag",
        monat,
        halbtage: 4,
      });
      expect(antwort.status, monat).toBe(409);
      expect(await json(antwort)).toEqual({ fehler: "widerspruch" });
    }
  });

  it("refuses a cut-off date in the future or before the person joined", async () => {
    const w = await weberMitAbwesenheiten();
    for (const monat of ["2026-12", "2026-09"]) {
      const antwort = await anpassen(w.jonas, w.sandra, {
        art: "urlaub_stichtag",
        monat,
        halbtage: 4,
      });
      expect(antwort.status, monat).toBe(422);
    }
  });

  it("is the owner's: payroll, planner and the person get 403", async () => {
    const { anna, lohn, sandra } = await weberMitAbwesenheiten();
    for (const wer of [anna, lohn, sandra]) {
      const antwort = await anpassen(wer, sandra, {
        art: "urlaub_stichtag",
        monat: "2026-11",
        halbtage: 4,
      });
      expect(antwort.status).toBe(403);
    }
  });
});

describe("the content of the month of the cut-off date (S-708)", () => {
  it("carries the start balances, so the Prüfwert the person holds covers them", async () => {
    const w = await weberMitAbwesenheiten();
    for (const body of [
      { art: "startsaldo", monat: "2026-10", minuten: -195 },
      { art: "urlaub_stichtag", monat: "2026-10", halbtage: 17 },
    ])
      expect((await anpassen(w.jonas, w.sandra, body)).status).toBe(201);
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    const antwort = await abschliessen(w.jonas, w.sandra.nutzerId);
    expect(antwort.status).toBe(201);
    const daten = await json(antwort);
    const abschluss = daten.abschluss as Json;
    expect((abschluss.inhalt as Json).startsalden).toEqual([
      { art: "ueberstunden", minuten: -195, grund: "Übernahme" },
      { art: "urlaub", halbtage: 17, grund: "Übernahme" },
    ]);
    const pruefung = await pruefen(w.server, w.jonas.betriebId, abschluss.pruefwert as string);
    expect(pruefung).toMatchObject({ ergebnis: "uebereinstimmend" });
    const monat = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect((monat.inhalt as Json).startsalden).toHaveLength(2);
  });

  it("leaves the key out of a month without start balances, so older contents keep their hash", async () => {
    const w = await weberMitAbwesenheiten();
    const monat = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect(monat.inhalt).not.toHaveProperty("startsalden");
  });

  it("withdraws the person's confirmation when a start balance is added to the month after it", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    await anpassen(w.jonas, w.sandra, { art: "startsaldo", monat: "2026-10", minuten: 60 });
    const monat = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect((monat.bestaetigung as Json).gueltig).toBe(false);
  });
});

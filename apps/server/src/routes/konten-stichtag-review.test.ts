import { describe, expect, it } from "vitest";
import { weberMitAbwesenheiten } from "./abwesenheit-testhilfen.ts";
import { anpassen, hinweis, type Json, json, konten, um } from "./konten-testhilfen.ts";
import { abschliessen, bestaetigen, pruefen } from "./monat-testhilfen.ts";

/* Review S-708 (tdd-review): a notice, the cut-off date and closed months */

const urlaub = (k: Json) => k.urlaub as Json;

describe("review S-708: notice and cut-off date", () => {
  it("does not let leave expire that a notice given before the cut-off balance did not name", async () => {
    const w = await weberMitAbwesenheiten();
    const h = await hinweis(w.jonas, w.sandra, "2026-10-15");
    expect(h.status).toBe(201);
    const benannt = ((await json(h)).inhalt as Json[]).reduce(
      (s, t) => s + (t.halbtage as number),
      0,
    );
    // cut-off date 1.10., before the day of the notice, but entered after it
    const antwort = await anpassen(w.jonas, w.sandra, {
      art: "urlaub_stichtag",
      monat: "2026-10",
      halbtage: 40,
    });
    if (antwort.status === 409) return; // refused: fine
    expect(antwort.status).toBe(201);
    w.server.stelleUhr(um("2028-01-03T09:00:00+01:00"));
    const k = urlaub(await konten(w.sandra));
    const topf2026 = (k.toepfe as Json[]).find((t) => t.jahr === 2026) as Json;
    // the notice named `benannt` half days; at most those may expire (EuGH C-684/16)
    expect(topf2026.verfallenHalbtage as number).toBeLessThanOrEqual(benannt);
  });
});

describe("review S-708: closed months and their Prüfwert", () => {
  it("keeps a closed month's content and Prüfwert when a start balance comes later", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    const zu = await json(await abschliessen(w.jonas, w.sandra.nutzerId));
    const vorher = zu.abschluss as Json;
    for (const body of [
      { art: "startsaldo", monat: "2026-11", minuten: 600 },
      { art: "urlaub_stichtag", monat: "2026-11", halbtage: 20 },
    ])
      expect((await anpassen(w.jonas, w.sandra, body)).status).toBe(409);
    const monat = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    const danach = monat.abschluss as Json;
    expect(danach.pruefwert).toBe(vorher.pruefwert);
    expect(danach.inhalt).toEqual(vorher.inhalt);
    expect(danach.inhalt).not.toHaveProperty("startsalden");
    expect(await pruefen(w.server, w.jonas.betriebId, vorher.pruefwert as string)).toMatchObject({
      ergebnis: "uebereinstimmend",
    });
  });

  it("keeps an old closing whose month holds a start balance from before S-708", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    const zu = await json(await abschliessen(w.jonas, w.sandra.nutzerId));
    const vorher = zu.abschluss as Json;
    // a row S-402 allowed in the closed month itself (bypassing the chain only to simulate old data)
    w.server.sqlite.run(
      `INSERT INTO konto_anpassungen (betrieb_id, anpassung_id, nutzer_id, art, monat, minuten, grund, erstellt_von, erstellt_am)
       VALUES (?, 'alt', ?, 'startsaldo', '2026-10', 60, 'alt', 'x', 0)`,
      [w.jonas.betriebId, w.sandra.nutzerId],
    );
    const monat = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect((monat.abschluss as Json).pruefwert).toBe(vorher.pruefwert);
    expect(monat.inhalt).not.toHaveProperty("startsalden");
    expect((monat.bestaetigung as Json).gueltig).toBe(true);
    expect(await pruefen(w.server, w.jonas.betriebId, vorher.pruefwert as string)).toMatchObject({
      ergebnis: "uebereinstimmend",
    });
  });

  it("refuses fractions and huge values by hand", async () => {
    const w = await weberMitAbwesenheiten();
    for (const body of [
      { art: "startsaldo", monat: "2026-11", minuten: 1.5 },
      { art: "urlaub_stichtag", monat: "2026-11", halbtage: 2.5 },
      { art: "urlaub_stichtag", monat: "2026-11", halbtage: 1e300 },
      { art: "startsaldo", monat: "2026-11", minuten: 9007199254740993 },
    ])
      expect((await anpassen(w.jonas, w.sandra, body)).status, JSON.stringify(body)).toBe(400);
  });
});

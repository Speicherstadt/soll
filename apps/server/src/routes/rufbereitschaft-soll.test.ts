import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { abschliessen, bestaetigen, type Json, json, pruefen } from "./monat-testhilfen.ts";
import { mitPlan, QUELLEN, summen } from "./rufbereitschaft-testhilfen.ts";

/* The Soll from the published plan against the Ist (S-505) */

const frueh = (standortId: string, nutzerId: string, tag: string) => ({
  standortId,
  nutzerId,
  tag,
  beginnMinute: 6 * 60,
  endeMinute: 14 * 60 + 30,
  pauseMinuten: 30,
  rolle: "Monteur",
});

const setzen = (
  wer: { anfrage: Awaited<ReturnType<typeof mitPlan>>["jonas"]["anfrage"] },
  body: Json,
) => wer.anfrage(QUELLEN, { method: "PUT", body });

describe("Soll aus dem Plan", () => {
  it("takes the month's Soll from the published shifts from its day on, drafts not", async () => {
    const w = await mitPlan();
    expect((await summen(w.sandra)).sollMinuten).toBe(21 * 480);
    const antwort = await setzen(w.jonas, { ab: "2026-11-01", quelle: "plan" });
    expect(antwort.status).toBe(200);
    expect(await json(antwort)).toEqual({ quellen: [{ ab: "2026-11-01", quelle: "plan" }] });
    for (const tag of ["2026-11-23", "2026-11-24"])
      await w.anna.anfrage("/api/v1/dienstplan/schichten", {
        body: frueh(w.standortId, w.sandra.nutzerId, tag),
      });
    expect((await summen(w.sandra)).sollMinuten).toBe(0);
    await w.anna.anfrage("/api/v1/dienstplan/veroeffentlichen", {
      body: { standortId: w.standortId, tag: "2026-11-23" },
    });
    await w.anna.anfrage("/api/v1/dienstplan/schichten", {
      body: frueh(w.standortId, w.sandra.nutzerId, "2026-11-25"),
    });
    expect((await summen(w.sandra)).sollMinuten).toBe(2 * 480);
    const monat = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-11"));
    const tag = ((monat.inhalt as Json).tage as Json[]).find((t) => t.tag === "2026-11-23");
    expect(tag).toMatchObject({ modellMinuten: 480, planMinuten: 480 });
    expect(kettePruefen(w.server.db, w.jonas.betriebId)).toEqual([]);
  });

  it("is set by the owner only, and the plan only with the module Dienstplan", async () => {
    const w = await mitPlan();
    const body = { ab: "2026-11-01", quelle: "plan" };
    expect((await setzen(w.sandra, body)).status).toBe(403);
    expect((await setzen(w.anna, body)).status).toBe(403);
    expect((await setzen(w.jonas, { ab: "1.11.2026", quelle: "plan" })).status).toBe(400);
    expect((await setzen(w.jonas, { ...body, quelle: "schaetzung" })).status).toBe(400);
    expect((await json(await w.sandra.anfrage(QUELLEN))).quellen).toEqual([]);
    await w.jonas.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { dienstplan: false },
    });
    const aus = await setzen(w.jonas, body);
    expect(aus.status).toBe(403);
    expect(await json(aus)).toEqual({ fehler: "modul_aus", modul: "dienstplan" });
    expect((await setzen(w.jonas, { ...body, quelle: "modell" })).status).toBe(200);
  });

  it("never reaches into a closed month: its content and Prüfwert stay", async () => {
    const w = await mitPlan();
    await bestaetigen(w.sandra);
    const abschluss = await json(await abschliessen(w.jonas, w.sandra.nutzerId));
    const pruefwert = (abschluss.abschluss as Json).pruefwert as string;
    const gesperrt = await setzen(w.jonas, { ab: "2026-10-15", quelle: "plan" });
    expect(gesperrt.status).toBe(409);
    expect(await json(gesperrt)).toEqual({ fehler: "monat_gesperrt" });
    expect(await json(await w.jonas.anfrage(QUELLEN))).toMatchObject({ fruehestens: "2026-11-01" });
    expect((await setzen(w.jonas, { ab: "2026-11-01", quelle: "plan" })).status).toBe(200);
    expect((await pruefen(w.server, w.jonas.betriebId, pruefwert)).ergebnis).toBe(
      "uebereinstimmend",
    );
  });
});

import { describe, expect, it } from "vitest";
import { elbblickMitBoten } from "./dienstplan-testhilfen.ts";
import { type Json, json } from "./monat-testhilfen.ts";
import {
  abends,
  EINSAETZE,
  einsatz,
  mitPlan,
  nachtragen,
  QUELLEN,
  RUF,
  rufPlanen,
} from "./rufbereitschaft-testhilfen.ts";

/* No business sees or changes the Rufbereitschaft, call-outs or Soll source of another (S-505) */

const fremderBetrieb = async (w: Awaited<ReturnType<typeof mitPlan>>) => {
  const mia = await w.server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  await mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
  const ort = await json(
    await mia.anfrage("/api/v1/standorte", { body: { name: "Elbe", land: "HH" } }),
  );
  return { mia, standortId: ort.standortId as string };
};

describe("tenant isolation of S-505", () => {
  it("another business can neither plan, change nor remove Weber's Rufbereitschaft", async () => {
    const w = await mitPlan();
    const f = await fremderBetrieb(w);
    const { rufdienst } = await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId));
    const pfad = `${RUF}/${rufdienst.rufdienstId}`;
    expect(
      (await f.mia.anfrage(pfad, { method: "PATCH", body: { reaktionMinuten: 5 } })).status,
    ).toBe(404);
    expect((await f.mia.anfrage(pfad, { method: "DELETE" })).status).toBe(404);
    const fuerSandra = await f.mia.anfrage(RUF, { body: abends(f.standortId, w.sandra.nutzerId) });
    expect(await json(fuerSandra)).toEqual({ fehler: "person_unbekannt" });
    const amOrt = await f.mia.anfrage(RUF, { body: abends(w.standortId, f.mia.nutzerId) });
    expect(await json(amOrt)).toEqual({ fehler: "standort_unbekannt" });
    const woche = await json(
      await f.mia.anfrage(`/api/v1/dienstplan/woche?standortId=${f.standortId}&tag=2026-11-19`),
    );
    expect(woche.rufdienste).toEqual([]);
  });

  it("another business neither reads nor removes Sandra's call-outs", async () => {
    const w = await mitPlan();
    const f = await fremderBetrieb(w);
    await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId));
    const eingetragen = await json(
      await nachtragen(w.sandra, einsatz("2026-11-19T22:00:00+01:00", "2026-11-19T23:00:00+01:00")),
    );
    expect((await f.mia.anfrage(`${EINSAETZE}?nutzerId=${w.sandra.nutzerId}`)).status).toBe(404);
    expect(((await json(await f.mia.anfrage(EINSAETZE))).einsaetze as Json[]).length).toBe(0);
    const entfernen = await f.mia.anfrage(`${EINSAETZE}/${eingetragen.einsatzId}/entfernen`, {
      body: { grund: "fremd" },
    });
    expect(entfernen.status).toBe(404);
    const fuerSandra = await nachtragen(
      f.mia,
      einsatz("2026-11-19T22:00:00+01:00", "2026-11-19T23:00:00+01:00", {
        nutzerId: w.sandra.nutzerId,
      }),
    );
    expect(fuerSandra.status).toBe(404);
  });

  it("the Soll source of one business is not the other's", async () => {
    const w = await mitPlan();
    const f = await fremderBetrieb(w);
    await w.jonas.anfrage(QUELLEN, { method: "PUT", body: { ab: "2026-11-01", quelle: "plan" } });
    expect((await json(await f.mia.anfrage(QUELLEN))).quellen).toEqual([]);
  });
});

describe("messages about Rufbereitschaft", () => {
  it("publishing tells Tom; a change and a removal of the published duty tell him again", async () => {
    const c = await elbblickMitBoten();
    await c.abonnieren(c.tom, "tom", "en");
    const { rufdienst } = await rufPlanen(c.lea, abends(c.standortId, c.tom.nutzerId), false);
    const fertig = await c.lea.anfrage("/api/v1/dienstplan/veroeffentlichen", {
      body: { standortId: c.standortId, tag: "2026-11-19" },
    });
    expect(await json(fertig)).toEqual({ anzahl: 1, benachrichtigt: 1 });
    const pfad = `${RUF}/${rufdienst.rufdienstId}`;
    await c.lea.anfrage(pfad, { method: "PATCH", body: { beginnMinute: 19 * 60 } });
    await c.lea.anfrage(pfad, { method: "DELETE" });
    const titel = c.zugestellt.map((z) => (z.inhalt as { titel?: string }).titel);
    expect(titel).toEqual(["Rota published", "On-call duty changed", "On-call duty cancelled"]);
  });
});

import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { type Json, json, um } from "./monat-testhilfen.ts";
import {
  abends,
  EINSAETZE,
  einsatz,
  mitPlan,
  nachtragen,
  RUF,
  rufPlanen,
  summen,
} from "./rufbereitschaft-testhilfen.ts";

/* Rufbereitschaft in the plan and call-outs as working time (S-505) */

const woche = async (wer: { anfrage: (p: string) => Promise<Response> }, standortId: string) =>
  json(await wer.anfrage(`/api/v1/dienstplan/woche?standortId=${standortId}&tag=2026-11-19`));

describe("Rufbereitschaft in the plan", () => {
  it("is a draft for whoever plans until the week is published, then Sandra reads it", async () => {
    const w = await mitPlan();
    const { antwort, rufdienst } = await rufPlanen(
      w.anna,
      abends(w.standortId, w.sandra.nutzerId),
      false,
    );
    expect(antwort.status).toBe(201);
    expect(rufdienst).toMatchObject({
      tag: "2026-11-19",
      beginn: um("2026-11-19T18:00:00+01:00"),
      ende: um("2026-11-20T06:00:00+01:00"),
      reaktionMinuten: 45,
      veroeffentlichtAm: null,
    });
    expect((await woche(w.anna, w.standortId)).rufdienste).toHaveLength(1);
    expect((await woche(w.sandra, w.standortId)).rufdienste).toEqual([]);
    const fertig = await w.anna.anfrage("/api/v1/dienstplan/veroeffentlichen", {
      body: { standortId: w.standortId, tag: "2026-11-19" },
    });
    expect(await json(fertig)).toMatchObject({ anzahl: 1 });
    expect((await woche(w.sandra, w.standortId)).rufdienste).toHaveLength(1);
    expect(kettePruefen(w.server.db, w.jonas.betriebId)).toEqual([]);
  });

  it("is planned, changed and removed only by owner and planner", async () => {
    const w = await mitPlan();
    const body = abends(w.standortId, w.sandra.nutzerId);
    expect((await w.sandra.anfrage(RUF, { body })).status).toBe(403);
    expect((await w.lohn.anfrage(RUF, { body })).status).toBe(403);
    const { rufdienst } = await rufPlanen(w.jonas, body, false);
    const pfad = `${RUF}/${rufdienst.rufdienstId}`;
    const aendern = { method: "PATCH", body: { reaktionMinuten: 10 } };
    expect((await w.sandra.anfrage(pfad, aendern)).status).toBe(403);
    expect(await json(await w.anna.anfrage(pfad, aendern))).toMatchObject({ reaktionMinuten: 10 });
    expect((await w.sandra.anfrage(pfad, { method: "DELETE" })).status).toBe(403);
    expect((await w.anna.anfrage(pfad, { method: "DELETE" })).status).toBe(204);
    expect((await w.anna.anfrage(pfad, { method: "DELETE" })).status).toBe(404);
  });

  it("refuses a time the clocks skip, an end equal to the start and an unknown person", async () => {
    const w = await mitPlan();
    const zeit = { ...abends(w.standortId, w.sandra.nutzerId, "2027-03-28"), beginnMinute: 150 };
    const antwort = await w.anna.anfrage(RUF, { body: zeit });
    expect(antwort.status).toBe(422);
    expect(await json(antwort)).toEqual({ fehler: "zeit_gibt_es_nicht" });
    const gleich = { ...abends(w.standortId, w.sandra.nutzerId), endeMinute: 18 * 60 };
    expect((await w.anna.anfrage(RUF, { body: gleich })).status).toBe(400);
    const niemand = abends(w.standortId, "niemand");
    expect((await w.anna.anfrage(RUF, { body: niemand })).status).toBe(404);
  });

  it("shows a finding of R-02 at a duty without reaction time (Matzak)", async () => {
    const w = await mitPlan();
    const body = {
      ...abends(w.standortId, w.sandra.nutzerId, "2026-11-23"),
      reaktionMinuten: null,
    };
    const { rufdienst } = await rufPlanen(w.anna, body, false);
    const plan = json(
      await w.anna.anfrage(`/api/v1/dienstplan/woche?standortId=${w.standortId}&tag=2026-11-23`),
    );
    expect(((await plan).befunde as Json[]).map((b) => [b.regel, b.schichtIds])).toContainEqual([
      "R-02",
      [rufdienst.rufdienstId],
    ]);
  });

  it("stands in Sandra's calendar feed as Rufbereitschaft with its reaction time", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId));
    const { url } = await json(
      await w.sandra.anfrage("/api/v1/dienstplan/kalender", { body: { sprache: "de" } }),
    );
    const feed = await (
      await w.server.app.request(url as string, { headers: { cookie: "" } })
    ).text();
    expect(feed).toContain("SUMMARY:Rufbereitschaft\r\n");
    expect(feed).toContain("DESCRIPTION:Reaktionszeit: 45 min\r\n");
    expect(feed).toContain("DTSTART:20261119T170000Z\r\n");
  });

  it("is refused while the module Dienstplan is off", async () => {
    const w = await mitPlan();
    await w.jonas.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { dienstplan: false },
    });
    const antwort = await w.anna.anfrage(RUF, { body: abends(w.standortId, w.sandra.nutzerId) });
    expect(antwort.status).toBe(403);
    expect(
      (
        await w.sandra.anfrage(EINSAETZE, {
          body: einsatz("2026-11-19T22:00:00+01:00", "2026-11-19T23:00:00+01:00"),
        })
      ).status,
    ).toBe(403);
    expect((await w.sandra.anfrage(`${EINSAETZE}/beginnen`, { body: {} })).status).toBe(403);
  });
});

describe("call-outs", () => {
  it("entered afterwards count as working time in the month, in the audit chain", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId));
    const vorher = await summen(w.sandra);
    const antwort = await nachtragen(
      w.sandra,
      einsatz("2026-11-19T22:00:00+01:00", "2026-11-19T23:30:00+01:00"),
    );
    expect(antwort.status).toBe(201);
    const nachher = await summen(w.sandra);
    expect(nachher.gearbeitetMinuten).toBe((vorher.gearbeitetMinuten as number) + 90);
    const monat = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-11"));
    const tag = ((monat.inhalt as Json).tage as Json[]).find((t) => t.tag === "2026-11-19");
    expect(tag?.einsaetze).toEqual([
      [um("2026-11-19T22:00:00+01:00"), um("2026-11-19T23:30:00+01:00")],
    ]);
    expect(kettePruefen(w.server.db, w.jonas.betriebId)).toEqual([]);
  });

  it("begin and end live on the server's clock, and an open one holds up nothing else", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId, "2026-11-20"));
    expect((await w.sandra.anfrage(`${EINSAETZE}/beginnen`, { body: {} })).status).toBe(409);
    w.server.stelleUhr(um("2026-11-20T21:14:30+01:00"));
    const begonnen = await w.sandra.anfrage(`${EINSAETZE}/beginnen`, { body: {} });
    expect(begonnen.status).toBe(201);
    expect(await json(begonnen)).toMatchObject({
      beginn: um("2026-11-20T21:14:00+01:00"),
      ende: null,
    });
    expect((await w.sandra.anfrage(`${EINSAETZE}/beginnen`, { body: {} })).status).toBe(409);
    const stand = await json(await w.sandra.anfrage(EINSAETZE));
    expect(stand.laufend).toMatchObject({ ende: null });
    expect(stand.jetzt).toMatchObject({ tag: "2026-11-20" });
    w.server.stelleUhr(um("2026-11-20T22:40:10+01:00"));
    const beendet = await w.sandra.anfrage(`${EINSAETZE}/beenden`, { body: {} });
    // rounded up, never to the person's disadvantage
    expect(await json(beendet)).toMatchObject({ ende: um("2026-11-20T22:41:00+01:00") });
    expect((await w.sandra.anfrage(`${EINSAETZE}/beenden`, { body: {} })).status).toBe(409);
  });

  it("must begin in one's own published Rufbereitschaft, and have ended, without overlap", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId, "2026-11-18"), false);
    const draft = einsatz("2026-11-18T22:00:00+01:00", "2026-11-18T23:00:00+01:00");
    expect(await json(await nachtragen(w.sandra, draft))).toEqual({
      fehler: "keine_rufbereitschaft",
    });
    await rufPlanen(w.anna, abends(w.standortId, w.anna.nutzerId));
    const fremd = einsatz("2026-11-19T22:00:00+01:00", "2026-11-19T23:00:00+01:00");
    expect((await nachtragen(w.sandra, fremd)).status).toBe(409);
    await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId));
    expect((await nachtragen(w.sandra, fremd)).status).toBe(201);
    expect((await nachtragen(w.sandra, fremd)).status).toBe(409);
    const zukunft = einsatz("2026-11-20T08:00:00+01:00", "2026-11-20T10:00:00+01:00");
    expect((await nachtragen(w.sandra, zukunft)).status).toBe(422);
    expect((await nachtragen(w.sandra, { ...fremd, grund: "" })).status).toBe(400);
  });

  it("are entered for others by whoever corrects times, never by a colleague", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId));
    const body = einsatz("2026-11-19T22:00:00+01:00", "2026-11-19T23:00:00+01:00", {
      nutzerId: w.sandra.nutzerId,
    });
    expect((await nachtragen(w.lohn, body)).status).toBe(403);
    const eingetragen = await json(await nachtragen(w.anna, body));
    expect(eingetragen.erstelltVon).toBe(w.anna.nutzerId);
    const pfad = `${EINSAETZE}/${eingetragen.einsatzId}/entfernen`;
    expect((await w.sandra.anfrage(pfad, { body: {} })).status).toBe(400);
    expect(await json(await w.sandra.anfrage(pfad, { body: { grund: "doppelt" } }))).toMatchObject({
      entfernt: true,
      entferntGrund: "doppelt",
    });
    expect((await w.sandra.anfrage(pfad, { body: { grund: "doppelt" } })).status).toBe(404);
  });

  it("are refused where they would change a closed month", async () => {
    const w = await mitPlan();
    await rufPlanen(w.anna, abends(w.standortId, w.sandra.nutzerId, "2026-10-20"));
    await w.sandra.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", { body: { monat: "2026-10" } });
    await w.jonas.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: w.sandra.nutzerId },
    });
    const antwort = await nachtragen(
      w.sandra,
      einsatz("2026-10-20T22:00:00+02:00", "2026-10-20T23:00:00+02:00"),
    );
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "monat_gesperrt" });
  });
});

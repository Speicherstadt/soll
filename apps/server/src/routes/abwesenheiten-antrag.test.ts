import { describe, expect, it } from "vitest";
import { smtpMailer } from "../modules/mail/index.ts";
import { smtpTestServer } from "../modules/mail/smtp-test.ts";
import {
  adresse,
  angelegt,
  antrag,
  genehmigt,
  type Json,
  json,
  liste,
  offen,
  schritt,
  weberMitAbwesenheiten,
} from "./abwesenheit-testhilfen.ts";

// Leave from Monday 21 to Wednesday 23 December 2026, the last day half
const DEZEMBER = { art: "urlaub", von: "2026-12-21", bis: "2026-12-23", letzterHalb: true };

const eintrag = async (wer: Parameters<typeof liste>[0], id: string) =>
  ((await liste(wer)).abwesenheiten as Json[]).find((a) => a.abwesenheitId === id);

describe("Urlaub: Antrag, Freigabe, Ablehnung, Zurückziehen, Storno (S-401)", () => {
  it("asks for leave with the days it takes and the leave left in the year", async () => {
    const { sandra } = await weberMitAbwesenheiten();
    const antwort = await antrag(sandra, DEZEMBER);
    expect(antwort.status).toBe(201);
    const daten = await json(antwort);
    expect(daten).toMatchObject({
      art: "urlaub",
      von: "2026-12-21",
      bis: "2026-12-23",
      status: "beantragt",
      urlaubHalbtage: 5,
      eigeneSchichten: [],
    });
    // from 1 October: 3 full months of 20 days (§ 5 Abs. 1 Buchst. a BUrlG), 5 days
    expect(daten.urlaub).toEqual({
      jahr: 2026,
      anspruchHalbtage: 10,
      genommenHalbtage: 0,
      beantragtHalbtage: 5,
      restHalbtage: 10,
    });
  });

  it("counts no weekend and no holiday as leave (§ 3 Abs. 2 BUrlG)", async () => {
    const { sandra } = await weberMitAbwesenheiten();
    // 24.12. to 28.12.: Thursday, Friday the 25th (holiday), Saturday the 26th, Sunday, Monday
    const daten = await json(
      await antrag(sandra, { art: "urlaub", von: "2026-12-24", bis: "2026-12-28" }),
    );
    expect(daten.urlaubHalbtage).toBe(4);
  });

  it("lets owner and planner approve, and counts approved leave", async () => {
    const w = await weberMitAbwesenheiten();
    const id = await angelegt(antrag(w.sandra, DEZEMBER));
    expect((await schritt(w.max, id, "freigeben")).status).toBe(403);
    expect((await schritt(w.lohn, id, "freigeben")).status).toBe(403);
    expect(((await offen(w.anna)).antraege as Json[]).map((a) => a.abwesenheitId)).toEqual([id]);
    const antwort = await schritt(w.anna, id, "freigeben");
    expect(antwort.status).toBe(200);
    expect(await json(antwort)).toMatchObject({
      status: "genehmigt",
      entschiedenVon: w.anna.nutzerId,
    });
    expect((await offen(w.anna)).antraege).toEqual([]);
    expect((await liste(w.sandra)).urlaub).toMatchObject({ genommenHalbtage: 5, restHalbtage: 5 });
    expect((await schritt(w.jonas, id, "freigeben")).status).toBe(409);
  });

  it("refuses with a reason only, once", async () => {
    const w = await weberMitAbwesenheiten();
    const id = await angelegt(antrag(w.sandra, DEZEMBER));
    expect((await schritt(w.jonas, id, "ablehnen")).status).toBe(400);
    const antwort = await schritt(w.jonas, id, "ablehnen", { grund: "zu wenig Besetzung" });
    expect(await json(antwort)).toMatchObject({ status: "abgelehnt", grund: "zu wenig Besetzung" });
    expect(await eintrag(w.sandra, id)).toMatchObject({
      status: "abgelehnt",
      grund: "zu wenig Besetzung",
    });
    expect((await schritt(w.jonas, id, "freigeben")).status).toBe(409);
    expect((await liste(w.sandra)).urlaub).toMatchObject({
      genommenHalbtage: 0,
      beantragtHalbtage: 0,
    });
  });

  it("lets only the person withdraw a request not decided yet", async () => {
    const w = await weberMitAbwesenheiten();
    const id = await angelegt(antrag(w.sandra, DEZEMBER));
    expect((await schritt(w.jonas, id, "zurueckziehen")).status).toBe(403);
    expect(await json(await schritt(w.sandra, id, "zurueckziehen"))).toMatchObject({
      status: "zurueckgezogen",
    });
    const zweiter = await genehmigt(w, w.sandra, DEZEMBER);
    expect((await schritt(w.sandra, zweiter, "zurueckziehen")).status).toBe(409);
  });

  it("lets only the business cancel approved leave, with a reason", async () => {
    const w = await weberMitAbwesenheiten();
    const id = await genehmigt(w, w.sandra, DEZEMBER);
    expect((await schritt(w.sandra, id, "stornieren", { grund: "doch nicht" })).status).toBe(403);
    expect((await schritt(w.anna, id, "stornieren")).status).toBe(400);
    expect(
      await json(await schritt(w.anna, id, "stornieren", { grund: "Notdienst über Weihnachten" })),
    ).toMatchObject({ status: "storniert", grund: "Notdienst über Weihnachten" });
    expect((await liste(w.sandra)).urlaub).toMatchObject({ genommenHalbtage: 0, restHalbtage: 10 });
  });

  it("refuses a request that overlaps another, and one that ends before it begins", async () => {
    const w = await weberMitAbwesenheiten();
    const id = await angelegt(antrag(w.sandra, DEZEMBER));
    const doppelt = await antrag(w.sandra, {
      art: "sonderurlaub",
      von: "2026-12-23",
      bis: "2026-12-23",
    });
    expect(doppelt.status).toBe(409);
    expect(await json(doppelt)).toEqual({ fehler: "ueberschneidung" });
    await schritt(w.sandra, id, "zurueckziehen");
    expect((await antrag(w.sandra, DEZEMBER)).status).toBe(201);
    expect(
      (await antrag(w.max, { art: "urlaub", von: "2026-12-23", bis: "2026-12-21" })).status,
    ).toBe(422);
    expect(
      (await antrag(w.max, { art: "krank", von: "2026-12-21", bis: "2026-12-21" })).status,
    ).toBe(400);
    expect(
      (await antrag(w.max, { ...DEZEMBER, diagnose: "Grippe" })).status,
      "no field for a diagnosis",
    ).toBe(400);
  });

  it("refuses requests of external staff, who do not work here", async () => {
    const w = await weberMitAbwesenheiten();
    const extern = await w.server.eingeladen(w.jonas, "extern", "extern");
    expect((await antrag(extern, DEZEMBER)).status).toBe(403);
  });
});

describe("Benachrichtigung beider Seiten (S-401, SMTP test server)", () => {
  it("tells owner and planner of a request and the person of the decision", async () => {
    const smtp = await smtpTestServer();
    const w = await weberMitAbwesenheiten({ mail: smtpMailer(smtp.url, "Soll <soll@weber.test>") });
    adresse(w.server, w.anna, "anna@weber.test");
    adresse(w.server, w.sandra, "sandra@weber.test");
    const id = await angelegt(antrag(w.sandra, DEZEMBER));
    expect(smtp.empfangen.map((m) => m.an[0]).sort()).toEqual([
      "anna@weber.test",
      "weber@betrieb.test",
    ]);
    expect(smtp.empfangen[0]?.betreff).toBe("Antrag: Urlaub von sandra");
    expect(smtp.empfangen[0]?.text).toContain("vom 21.12.2026 bis 23.12.2026");
    await schritt(w.jonas, id, "ablehnen", { grund: "zu wenig Besetzung" });
    const [entscheidung] = smtp.empfangen.slice(2);
    expect(entscheidung?.an).toEqual(["sandra@weber.test"]);
    expect(entscheidung?.betreff).toBe("Urlaub vom 21.12.2026 bis 23.12.2026: abgelehnt");
    expect(entscheidung?.text).toContain("Grund: zu wenig Besetzung");
  });
});

describe("Schnittstelle zum Dienstplan (S-501)", () => {
  it("shows the person's own shifts in the span of a request", async () => {
    const schicht = {
      schichtId: "s1",
      tag: "2026-12-23",
      beginn: Date.parse("2026-12-23T07:00:00+01:00"),
      ende: Date.parse("2026-12-23T15:00:00+01:00"),
      bezeichnung: "Frühschicht",
    };
    const w = await weberMitAbwesenheiten({
      schichten: (_, nutzerId, von, bis) =>
        schicht.tag >= von && schicht.tag <= bis ? [{ ...schicht, nutzerId }] : [],
    });
    const daten = await json(await antrag(w.sandra, DEZEMBER));
    expect(daten.eigeneSchichten).toEqual([{ ...schicht, nutzerId: w.sandra.nutzerId }]);
  });
});

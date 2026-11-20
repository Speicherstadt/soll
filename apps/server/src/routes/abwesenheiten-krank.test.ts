import { describe, expect, it } from "vitest";
import { smtpMailer } from "../modules/mail/index.ts";
import { smtpTestServer } from "../modules/mail/smtp-test.ts";
import {
  adresse,
  angelegt,
  type Json,
  json,
  krank,
  liste,
  offen,
  schritt,
  um,
  weberMitAbwesenheiten,
} from "./abwesenheit-testhilfen.ts";

// Friday 20 November 2026; the certificate of a sickness from today is due on Monday the 23rd
const MONTAG = um("2026-11-23T09:00:00+01:00");
const DIENSTAG = um("2026-11-24T09:00:00+01:00");

const eintrag = async (wer: Parameters<typeof liste>[0], abfrage = "") =>
  ((await liste(wer, abfrage)).abwesenheiten as Json[])[0] ?? {};

describe("Krankmeldung (S-401)", () => {
  it("reports sickness from today, without a diagnosis, counted at once", async () => {
    const { sandra } = await weberMitAbwesenheiten();
    const antwort = await krank(sandra);
    expect(antwort.status).toBe(201);
    expect(await json(antwort)).toMatchObject({
      art: "krank",
      von: "2026-11-20",
      bis: null,
      status: "genehmigt",
      bescheinigung: null,
      frist: { faelligAm: "2026-11-23", stand: "spaeter", eauAbrufen: false },
      offeneSchichten: [],
    });
    expect((await krank(sandra, { art: "krank", diagnose: "Grippe" })).status).toBe(400);
  });

  it("refuses an end in the past, a child's sickness without a child and two at once", async () => {
    const { sandra, max } = await weberMitAbwesenheiten();
    expect((await krank(sandra, { art: "krank", bis: "2026-11-19" })).status).toBe(422);
    expect((await krank(sandra, { art: "kind_krank" })).status).toBe(422);
    expect((await krank(sandra, { art: "krank", kind: "1" })).status).toBe(422);
    await angelegt(krank(max));
    expect((await krank(max)).status).toBe(409);
  });

  it("ends a sickness once its end is known, only the person or whoever may see it", async () => {
    const w = await weberMitAbwesenheiten();
    const id = await angelegt(krank(w.sandra));
    expect((await schritt(w.anna, id, "beenden", { bis: "2026-11-22" })).status).toBe(403);
    expect((await schritt(w.sandra, id, "beenden", { bis: "2026-11-19" })).status).toBe(422);
    expect(await json(await schritt(w.sandra, id, "beenden", { bis: "2026-11-22" }))).toMatchObject(
      {
        bis: "2026-11-22",
      },
    );
    // three calendar days: no certificate needed (§ 5 Abs. 1 Satz 2 EntgFG)
    expect((await eintrag(w.sandra)).frist).toMatchObject({
      faelligAm: null,
      stand: "nicht_noetig",
    });
  });

  it("lets only whoever may see sickness cancel one reported by mistake", async () => {
    const w = await weberMitAbwesenheiten();
    const id = await angelegt(krank(w.sandra));
    expect((await schritt(w.anna, id, "stornieren", { grund: "Irrtum" })).status).toBe(403);
    expect((await schritt(w.sandra, id, "zurueckziehen")).status).toBe(403);
    expect(await json(await schritt(w.lohn, id, "stornieren", { grund: "Irrtum" }))).toMatchObject({
      status: "storniert",
    });
  });
});

describe("R-27: Frist am 4. Tag und Erinnerung an die eAU (§ 5 EntgFG, § 109 SGB IV)", () => {
  it("reminds person and business on the day the certificate is due and after", async () => {
    const w = await weberMitAbwesenheiten();
    const id = await angelegt(krank(w.sandra));
    expect((await offen(w.jonas)).erinnerungen).toEqual([]);

    w.server.stelleUhr(MONTAG);
    expect((await eintrag(w.sandra)).frist).toMatchObject({ stand: "heute", eauAbrufen: true });
    const erinnerung = {
      abwesenheitId: id,
      nutzerId: w.sandra.nutzerId,
      name: "sandra",
      von: "2026-11-20",
      faelligAm: "2026-11-23",
      ueberfaellig: false,
    };
    expect((await offen(w.jonas)).erinnerungen).toEqual([erinnerung]);
    expect((await offen(w.lohn)).erinnerungen).toEqual([erinnerung]);
    // the planner sees no sickness, so no reminder of one either (Art. 9 DSGVO)
    expect((await offen(w.anna)).erinnerungen).toEqual([]);
    expect((await w.max.anfrage("/api/v1/arbeitszeit/abwesenheiten/offen")).status).toBe(403);

    w.server.stelleUhr(DIENSTAG);
    expect((await eintrag(w.sandra)).frist).toMatchObject({
      stand: "ueberfaellig",
      befunde: [{ regel: "R-27", norm: "§ 5 Abs. 1 Satz 2 EntgFG", tage: ["2026-11-23"] }],
    });
    expect((await offen(w.jonas)).erinnerungen).toEqual([{ ...erinnerung, ueberfaellig: true }]);

    // the business fetched the eAU: nothing more to remind of; only the mark, no file
    expect((await schritt(w.anna, id, "bescheinigung", { bescheinigung: "eau" })).status).toBe(403);
    expect(
      await json(await schritt(w.lohn, id, "bescheinigung", { bescheinigung: "eau" })),
    ).toMatchObject({ bescheinigung: "eau" });
    expect((await offen(w.jonas)).erinnerungen).toEqual([]);
    expect((await eintrag(w.sandra)).frist).toMatchObject({ stand: "liegt_vor", befunde: [] });
    expect(
      (await schritt(w.sandra, id, "bescheinigung", { bescheinigung: "datei.pdf" })).status,
    ).toBe(400);
  });

  it("asks for it earlier when the business sets so (§ 5 Abs. 1 Satz 3 EntgFG)", async () => {
    const w = await weberMitAbwesenheiten();
    const setzen = (wer: Parameters<typeof liste>[0], tag: number) =>
      wer.anfrage("/api/v1/arbeitszeit/abwesenheiten/einstellungen", {
        method: "PUT",
        body: { bescheinigungAbTag: tag },
      });
    expect((await setzen(w.anna, 1)).status).toBe(403);
    expect((await setzen(w.jonas, 5)).status).toBe(400);
    expect(await json(await setzen(w.jonas, 1))).toEqual({ bescheinigungAbTag: 1 });
    const daten = await json(await krank(w.sandra));
    expect(daten.frist).toMatchObject({
      faelligAm: "2026-11-20",
      stand: "heute",
      eauAbrufen: true,
    });
    expect((await liste(w.sandra)).bescheinigungAbTag).toBe(1);
  });

  it("mails the business: the kind and the deadline to the owner, „abwesend“ to the planner", async () => {
    const smtp = await smtpTestServer();
    const w = await weberMitAbwesenheiten({ mail: smtpMailer(smtp.url, "Soll <soll@weber.test>") });
    adresse(w.server, w.anna, "anna@weber.test");
    await angelegt(krank(w.sandra));
    const an = (adresse: string) => smtp.empfangen.find((m) => m.an.includes(adresse));
    expect(an("weber@betrieb.test")?.text).toContain(
      "sandra hat sich ab 20.11.2026 krank gemeldet.",
    );
    expect(an("weber@betrieb.test")?.text).toContain("am 23.11.2026 fällig");
    expect(an("weber@betrieb.test")?.text).toContain("eAU");
    expect(an("anna@weber.test")?.betreff).toBe("sandra: abwesend ab 20.11.2026");
    expect(an("anna@weber.test")?.text).not.toContain("krank");
  });

  it("reports the planned shifts of a sickness as open (S-501)", async () => {
    const w = await weberMitAbwesenheiten({
      schichten: (_, nutzerId, von) => [
        { schichtId: "s1", nutzerId, tag: von, beginn: 0, ende: 1, bezeichnung: "Frühschicht" },
      ],
    });
    const daten = await json(await krank(w.sandra));
    expect(daten.offeneSchichten).toEqual([
      expect.objectContaining({ schichtId: "s1", tag: "2026-11-20", bezeichnung: "Frühschicht" }),
    ]);
  });
});

describe("Kinderkrankentage (R-28, § 45 SGB V)", () => {
  it("counts working days per child against the value of the year", async () => {
    const { sandra } = await weberMitAbwesenheiten();
    // Friday, the weekend, Monday and Tuesday: three working days
    await angelegt(krank(sandra, { art: "kind_krank", kind: "1", bis: "2026-11-24" }));
    const { kinderkrank } = await liste(sandra);
    expect(kinderkrank).toMatchObject({
      ok: true,
      wert: { jahr: 2026, jeKind: { "1": 3 }, gesamt: 3, anspruchJeKind: 15, befunde: [] },
    });
  });

  it("says „nicht hinterlegt“ for a year without the value, never another year's", async () => {
    const w = await weberMitAbwesenheiten();
    expect((await liste(w.sandra, "jahr=2031")).kinderkrank).toEqual({
      ok: false,
      grund: "nicht_hinterlegt",
    });
  });
});

describe("Sichtbarkeit von „krank“ je Rolle (Art. 9 DSGVO)", () => {
  it("shows the kind to the person, owner and payroll, „abwesend“ to the planner", async () => {
    const w = await weberMitAbwesenheiten();
    await angelegt(krank(w.sandra, { art: "kind_krank", kind: "1" }));
    const fuer = `nutzerId=${w.sandra.nutzerId}`;
    for (const wer of [w.sandra, w.jonas, w.lohn])
      expect(await eintrag(wer, wer === w.sandra ? "" : fuer)).toMatchObject({
        art: "kind_krank",
        kind: "1",
      });
    const planer = await liste(w.anna, fuer);
    expect((planer.abwesenheiten as Json[])[0]).toMatchObject({
      art: "abwesend",
      kind: null,
      frist: null,
    });
    expect(planer.kinderkrank).toBeNull();
    expect((await w.max.anfrage(`/api/v1/arbeitszeit/abwesenheiten?${fuer}`)).status).toBe(403);
  });

  it("shows only „abwesend“ in the team calendar, to everyone, the owner too", async () => {
    const w = await weberMitAbwesenheiten();
    await angelegt(krank(w.sandra));
    for (const wer of [w.jonas, w.anna, w.max, w.sandra]) {
      const team = await json(
        await wer.anfrage("/api/v1/arbeitszeit/abwesenheiten/team?von=2026-11-16&bis=2026-11-29"),
      );
      expect(team.abwesenheiten).toEqual([
        expect.objectContaining({
          name: "sandra",
          art: "abwesend",
          von: "2026-11-20",
          offen: true,
        }),
      ]);
      expect(JSON.stringify(team)).not.toContain("krank");
    }
  });

  it("shows sickness on the month only to whoever may see it", async () => {
    const w = await weberMitAbwesenheiten();
    await angelegt(krank(w.sandra, { art: "krank", bis: "2026-11-20" }));
    const tagVon = async (wer: Parameters<typeof liste>[0]) => {
      const monat = await json(
        await wer.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-11&nutzerId=${w.sandra.nutzerId}`),
      );
      return (monat.inhalt as { tage: Json[] }).tage.find((t) => t.tag === "2026-11-20");
    };
    expect((await tagVon(w.jonas))?.abwesenheiten).toEqual([{ art: "krank" }]);
    expect((await tagVon(w.anna))?.abwesenheiten).toEqual([{ art: "abwesend" }]);
  });
});

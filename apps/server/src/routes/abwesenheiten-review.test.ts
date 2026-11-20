import { pdfText } from "@soll/export";
import { describe, expect, it } from "vitest";
import {
  angelegt,
  antrag,
  genehmigt,
  type Json,
  json,
  krank,
  liste,
  offen,
  schritt,
  um,
  weberMitAbwesenheiten,
} from "./abwesenheit-testhilfen.ts";
import { abschliessen, bestaetigen, pruefen } from "./monat-testhilfen.ts";

/** Findings of the independent review of S-401 */
describe("S-401 review", () => {
  it("lets no colleague tell sickness from leave in the team calendar (Art. 9 DSGVO)", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, { von: "2026-11-23", bis: "2026-11-24" });
    await angelegt(krank(w.max));
    const team = await json(
      await w.sandra.anfrage(
        "/api/v1/arbeitszeit/abwesenheiten/team?von=2026-11-16&bis=2026-11-29",
      ),
    );
    const eintraege = team.abwesenheiten as Json[];
    const ohne = ({ abwesenheitId: _, nutzerId: __, name: ___, von: ____, ...rest }: Json) => rest;
    // a colleague learns who is away and until when, never whether it is sickness
    expect(eintraege.map(ohne)).toEqual([
      { art: "abwesend", bis: "2026-11-29", ersterHalb: false, letzterHalb: false },
      { art: "abwesend", bis: "2026-11-24", ersterHalb: false, letzterHalb: false },
    ]);
  });

  it("marks the certificate of a sickness reaching back into a closed month", async () => {
    const w = await weberMitAbwesenheiten();
    // Thursday 29 October: the certificate is due on Monday 2 November (§ 5 Abs. 1 Satz 2 EntgFG)
    w.server.stelleUhr(um("2026-10-29T08:00:00+01:00"));
    const id = await angelegt(krank(w.sandra));
    w.server.stelleUhr(um("2026-11-03T09:00:00+01:00"));
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    const abschluss = await abschliessen(w.jonas, w.sandra.nutzerId);
    expect(abschluss.status).toBe(201);
    const pruefwert = ((await json(abschluss)).abschluss as Json).pruefwert as string;
    expect((await offen(w.jonas)).erinnerungen).toHaveLength(1);
    // the eAU is fetched: the reminder must go, the closed October stays as it was
    const antwort = await schritt(w.jonas, id, "bescheinigung", { bescheinigung: "eau" });
    expect(antwort.status, JSON.stringify(await json(antwort.clone()))).toBe(200);
    expect((await offen(w.jonas)).erinnerungen).toEqual([]);
    expect((await pruefen(w.server, w.jonas.betriebId, pruefwert)).ergebnis).toBe(
      "uebereinstimmend",
    );
  });

  it("still refuses the certificate of sickness in leave of a closed month (§ 9 BUrlG)", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, { von: "2026-10-26", bis: "2026-10-30" });
    w.server.stelleUhr(um("2026-10-28T08:00:00+01:00"));
    const id = await angelegt(krank(w.sandra, { art: "krank", bis: "2026-10-30" }));
    w.server.stelleUhr(um("2026-11-03T09:00:00+01:00"));
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    // here it would turn days of leave into sickness: a counter-entry corrects it (S-306)
    const antwort = await schritt(w.jonas, id, "bescheinigung", { bescheinigung: "eau" });
    expect(antwort.status).toBe(409);
  });

  it("takes a sickness report with an open end before later approved time off", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, {
      art: "sonderurlaub",
      von: "2026-12-10",
      bis: "2026-12-10",
    });
    // sick from today, the end not known yet: a day off in three weeks is no reason to refuse it
    const antwort = await krank(w.sandra);
    expect(antwort.status, JSON.stringify(await json(antwort.clone()))).toBe(201);
    const id = (await json(antwort)).abwesenheitId as string;
    // still sick on the day off: until the end is known, the day off holds its day, counted once
    w.server.stelleUhr(um("2026-12-11T09:00:00+01:00"));
    const dezember = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-12"));
    const inhalt = dezember.inhalt as { tage: Json[]; summen: Json | null };
    expect(inhalt.tage.find((t) => t.tag === "2026-12-10")?.abwesenheiten).toEqual([
      { art: "sonderurlaub" },
    ]);
    expect(inhalt.tage.find((t) => t.tag === "2026-12-11")?.abwesenheiten).toEqual([
      { art: "krank" },
    ]);
    expect(inhalt.summen).not.toBeNull();
    // an end beyond the day off: the day off keeps its day, counted once (review S-401, round 2)
    expect((await schritt(w.sandra, id, "beenden", { bis: "2026-12-11" })).status).toBe(200);
    const beendet = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-12"));
    const tage = (beendet.inhalt as { tage: Json[] }).tage;
    expect(tage.find((t) => t.tag === "2026-12-10")?.abwesenheiten).toEqual([
      { art: "sonderurlaub" },
    ]);
    expect(tage.find((t) => t.tag === "2026-12-11")?.abwesenheiten).toEqual([{ art: "krank" }]);
  });
});

/** Findings of the second review of S-401 */
describe("S-401 review, round 2", () => {
  const team = async (wer: { anfrage: (pfad: string) => Promise<Response> }, abfrage: string) =>
    ((await json(await wer.anfrage(`/api/v1/arbeitszeit/abwesenheiten/team?${abfrage}`)))
      .abwesenheiten ?? []) as Json[];

  it("shows no open-ended sickness in a team calendar that begins after today", async () => {
    const w = await weberMitAbwesenheiten();
    await angelegt(krank(w.sandra));
    await genehmigt(w, w.max, { von: "2027-03-10", bis: "2027-03-12" });
    // a year on, only an open end still reaches here: it would tell the sickness by its length
    const maerz = await team(w.max, "von=2027-03-01&bis=2027-03-31");
    expect(maerz.map((eintrag) => eintrag.nutzerId)).toEqual([w.max.nutzerId]);
    // while today is shown, the open end stays the last day shown, as for any absence beyond it
    const heute = await team(w.max, "von=2026-11-16&bis=2026-11-29");
    expect(heute.map((eintrag) => [eintrag.nutzerId, eintrag.bis])).toEqual([
      [w.sandra.nutzerId, "2026-11-29"],
    ]);
  });

  it("answers a colleague's certificate or end alike for leave and sickness", async () => {
    const w = await weberMitAbwesenheiten();
    const krankheit = await angelegt(krank(w.sandra));
    const urlaub = await genehmigt(w, w.anna, { von: "2026-12-21", bis: "2026-12-22" });
    // the ids stand in the team calendar; the answer may not tell which one is a sickness
    for (const id of [krankheit, urlaub]) {
      expect((await schritt(w.max, id, "bescheinigung", { bescheinigung: null })).status).toBe(403);
      expect((await schritt(w.max, id, "beenden", { bis: "2026-12-31" })).status).toBe(403);
    }
  });

  it("keeps a closed month's Prüfwert when an open sickness in its leave gets its end", async () => {
    const w = await weberMitAbwesenheiten();
    w.server.stelleUhr(um("2026-10-20T08:00:00+01:00"));
    const id = await angelegt(krank(w.sandra));
    await genehmigt(w, w.sandra, { von: "2026-10-26", bis: "2026-10-30" });
    w.server.stelleUhr(um("2026-11-03T09:00:00+01:00"));
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    const abschluss = await abschliessen(w.jonas, w.sandra.nutzerId);
    const pruefwert = ((await json(abschluss)).abschluss as Json).pruefwert as string;
    // the end changes no day of October: the sickness counted to its last day all along
    expect((await schritt(w.sandra, id, "beenden", { bis: "2026-11-03" })).status).toBe(200);
    expect((await pruefen(w.server, w.jonas.betriebId, pruefwert)).ergebnis).toBe(
      "uebereinstimmend",
    );
  });

  it("lets a sickness end after the month of a day off it gave way to is closed", async () => {
    const w = await weberMitAbwesenheiten();
    w.server.stelleUhr(um("2026-10-19T08:00:00+02:00"));
    await genehmigt(w, w.sandra, { art: "sonderurlaub", von: "2026-10-26", bis: "2026-10-26" });
    w.server.stelleUhr(um("2026-10-20T08:00:00+02:00"));
    const id = await angelegt(krank(w.sandra));
    w.server.stelleUhr(um("2026-11-03T09:00:00+01:00"));
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    const abschluss = await abschliessen(w.jonas, w.sandra.nutzerId);
    const pruefwert = ((await json(abschluss)).abschluss as Json).pruefwert as string;
    // back at work on 6 November: the day off can no longer be cancelled, the end must still go in
    w.server.stelleUhr(um("2026-11-06T09:00:00+01:00"));
    const antwort = await schritt(w.sandra, id, "beenden", { bis: "2026-11-05" });
    expect(antwort.status, JSON.stringify(await json(antwort.clone()))).toBe(200);
    expect((await pruefen(w.server, w.jonas.betriebId, pruefwert)).ergebnis).toBe(
      "uebereinstimmend",
    );
    const november = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-11"));
    const tage = (november.inhalt as { tage: Json[] }).tage;
    expect(tage.find((t) => t.tag === "2026-11-05")?.abwesenheiten).toEqual([{ art: "krank" }]);
    expect(tage.find((t) => t.tag === "2026-11-06")?.abwesenheiten).toBeUndefined();
  });
});

/** Findings of the third review of S-401: a planner tells leave from sickness by elimination */
describe("S-401 review, round 3", () => {
  /** Sandra on approved leave on Tuesday, sick on Friday (today), each one day */
  const urlaubUndKrankheit = async () => {
    const w = await weberMitAbwesenheiten();
    const urlaub = await genehmigt(w, w.sandra, { von: "2026-11-17", bis: "2026-11-17" });
    w.server.stelleUhr(um("2026-11-20T10:00:00+01:00"));
    const krankheit = await angelegt(krank(w.sandra, { art: "krank", bis: "2026-11-20" }));
    return { w, urlaub, krankheit };
  };

  it("shows a planner a person's approved leave and sickness alike in the list", async () => {
    const { w } = await urlaubUndKrankheit();
    const eintraege = (await liste(w.anna, `nutzerId=${w.sandra.nutzerId}`))
      .abwesenheiten as Json[];
    const ohne = ({ abwesenheitId: _, von: __, bis: ___, ...rest }: Json) => rest;
    expect(eintraege).toHaveLength(2);
    expect(eintraege[0]?.art).toBe("abwesend");
    expect(ohne(eintraege[0] ?? {})).toEqual(ohne(eintraege[1] ?? {}));
  });

  it("shows a planner a person's approved leave and sickness alike in the month", async () => {
    const { w } = await urlaubUndKrankheit();
    const monat = await json(
      await w.anna.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-11&nutzerId=${w.sandra.nutzerId}`),
    );
    const tage = (monat.inhalt as { tage: Json[] }).tage;
    const am = (tag: string) => tage.find((t) => t.tag === tag);
    expect(am("2026-11-17")?.abwesenheiten).toEqual([{ art: "abwesend" }]);
    expect(am("2026-11-20")?.abwesenheiten).toEqual([{ art: "abwesend" }]);
    expect(am("2026-11-17")?.modellMinuten).toBe(am("2026-11-20")?.modellMinuten);
  });

  it("writes no kind on the time sheet a planner fetches", async () => {
    const { w } = await urlaubUndKrankheit();
    const pdf = await w.anna.anfrage(
      `/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-11&nutzerId=${w.sandra.nutzerId}`,
    );
    expect(pdf.status).toBe(200);
    const text = pdfText(new Uint8Array(await pdf.arrayBuffer()));
    expect(text).not.toContain("Urlaub");
    expect(text.match(/abwesend/g)).toHaveLength(2);
  });

  it("still shows the planner the kind of an open request he decides on", async () => {
    const { w } = await urlaubUndKrankheit();
    await angelegt(antrag(w.sandra, { art: "sonderurlaub", von: "2026-12-14", bis: "2026-12-14" }));
    const eintraege = (await liste(w.anna, `nutzerId=${w.sandra.nutzerId}`))
      .abwesenheiten as Json[];
    expect(eintraege.map((e) => [e.art, e.status])).toEqual([
      ["abwesend", "genehmigt"],
      ["abwesend", "genehmigt"],
      ["sonderurlaub", "beantragt"],
    ]);
    expect(((await offen(w.anna)).antraege as Json[]).map((a) => a.art)).toEqual(["sonderurlaub"]);
  });

  it("answers a planner's step on approved leave and on sickness alike", async () => {
    const { w, urlaub, krankheit } = await urlaubUndKrankheit();
    const antworten = async (id: string) => [
      (await schritt(w.anna, id, "freigeben")).status,
      (await schritt(w.anna, id, "ablehnen", { grund: "nein" })).status,
      (await schritt(w.anna, id, "zurueckziehen")).status,
      (await schritt(w.anna, id, "stornieren", { grund: "Irrtum" })).status,
    ];
    // the leave was approved by the owner: the planner cancels only what they approved themselves
    expect(await antworten(urlaub)).toEqual(await antworten(krankheit));
  });

  it("offers a planner in the team calendar to cancel only the leave they approved", async () => {
    const { w } = await urlaubUndKrankheit();
    const eigen = await angelegt(
      antrag(w.max, { art: "urlaub", von: "2026-11-19", bis: "2026-11-19" }),
    );
    expect((await schritt(w.anna, eigen, "freigeben")).status).toBe(200);
    const team = await json(
      await w.anna.anfrage("/api/v1/arbeitszeit/abwesenheiten/team?von=2026-11-16&bis=2026-11-22"),
    );
    const eintraege = team.abwesenheiten as Json[];
    expect(eintraege.map((e) => [e.von, e.stornierbar])).toEqual([
      ["2026-11-17", false],
      ["2026-11-19", true],
      ["2026-11-20", false],
    ]);
    expect((await schritt(w.anna, eigen, "stornieren", { grund: "Notdienst" })).status).toBe(200);
  });
});

/** Round 3: the fixes of round 2 */
describe("S-401 review, round 3: the fixes of round 2", () => {
  const team = async (wer: { anfrage: (pfad: string) => Promise<Response> }, abfrage: string) =>
    ((await json(await wer.anfrage(`/api/v1/arbeitszeit/abwesenheiten/team?${abfrage}`)))
      .abwesenheiten ?? []) as Json[];

  it("does not let an open end tell itself by comparing a window from today with one from tomorrow", async () => {
    const w = await weberMitAbwesenheiten();
    await angelegt(krank(w.sandra));
    await genehmigt(w, w.max, { von: "2026-11-20", bis: "2027-01-15" });
    const ab = async (von: string, bis: string) =>
      (await team(w.anna, `von=${von}&bis=${bis}`)).map((e) => [e.nutzerId, e.bis]);
    // a long leave reaches past both windows; an open end may not look the same today and vanish
    // tomorrow, or it is known to be one
    const heute = await ab("2026-11-20", "2027-01-10");
    const morgen = await ab("2026-11-21", "2027-01-10");
    const reichtUeber = (liste: unknown[][]) =>
      liste.filter(([, bis]) => bis === "2027-01-10").map(([wer]) => wer);
    expect(reichtUeber(heute)).toEqual(reichtUeber(morgen));
  });

  it("credits the other half of a half day off to a sickness it gave way to", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, {
      art: "sonderurlaub",
      von: "2026-12-10",
      bis: "2026-12-10",
      ersterHalb: true,
    });
    await angelegt(krank(w.sandra));
    w.server.stelleUhr(um("2026-12-11T09:00:00+01:00"));
    const dezember = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-12"));
    // sick from 20 November to today, excused on every working day from 1 to 11 December: nine
    // days of 8:00; half of the 10th off, the other half sick (§ 3 EntgFG), never half a day short
    expect((dezember.inhalt as { summen: Json }).summen).toMatchObject({
      gutschriftMinuten: 9 * 480,
    });
  });
});

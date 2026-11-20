import { describe, expect, it } from "vitest";
import {
  angelegt,
  genehmigt,
  type Json,
  json,
  krank,
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
    // an end beyond the day off is refused until the business cancels it
    expect((await schritt(w.sandra, id, "beenden", { bis: "2026-12-11" })).status).toBe(409);
    expect((await schritt(w.sandra, id, "beenden", { bis: "2026-12-09" })).status).toBe(200);
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

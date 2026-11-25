import { describe, expect, it } from "vitest";
import { auditGlieder } from "../db/schema.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import {
  anbieten,
  angeboten,
  elbblickZumTausch,
  personDer,
  schritt,
  TAUSCH,
  tauschbuchVon,
} from "./dienstplan-tausch-testhilfen.ts";
import { type Browser, json, planen, schichtVon } from "./dienstplan-testhilfen.ts";

/* Offering, taking over and approving a shift (S-504) */

describe("a shift swap", () => {
  it("changes the person of the shift only on approval, with the swap in one transaction", async () => {
    const c = await elbblickZumTausch();
    const angebot = await anbieten(c.tom, c.schichtId);
    expect(angebot.status).toBe(201);
    const tausch = (await json(angebot)) as { tauschId: string; status: string };
    expect(tausch).toMatchObject({ status: "offen", anbieterId: c.tom.nutzerId, anNutzerId: null });

    const genommen = await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    expect(genommen.status).toBe(200);
    expect(await json(genommen)).toMatchObject({
      status: "uebernommen",
      uebernehmerId: c.yusuf.nutzerId,
    });
    expect((await personDer(c.lea, c.standortId, c.schichtId))?.nutzerId).toBe(c.tom.nutzerId);

    c.server.stelleUhr(Date.parse("2026-11-20T09:00:00Z"));
    const frei = await schritt(c.lea, tausch.tauschId, "freigeben");
    expect(frei.status).toBe(200);
    expect(await json(frei)).toMatchObject({
      status: "freigegeben",
      entschiedenVon: c.lea.nutzerId,
      entschiedenAm: c.server.jetzt(),
    });
    expect(await personDer(c.lea, c.standortId, c.schichtId)).toMatchObject({
      nutzerId: c.yusuf.nutzerId,
      // a new notice under § 12 TzBfG, as any change to a published shift (S-503)
      veroeffentlichtAm: c.server.jetzt(),
    });
    expect(kettePruefen(c.server.db, c.mia.betriebId)).toEqual([]);
    const [schichtGlied, tauschGlied] = c.server.db
      .select()
      .from(auditGlieder)
      .all()
      .filter((g) => g.betriebId === c.mia.betriebId)
      .slice(-2);
    expect([schichtGlied?.tabelle, tauschGlied?.tabelle]).toEqual(["schichten", "schichttausche"]);
    expect(tauschGlied?.zeitpunkt).toBe(schichtGlied?.zeitpunkt);
  });

  it("offers only an own published shift that has not begun, once at a time", async () => {
    const c = await elbblickZumTausch();
    const entwurf = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId, "2026-11-30"));
    const fehler = async (antwort: Response) => [antwort.status, (await json(antwort)).fehler];
    expect(await fehler(await anbieten(c.tom, entwurf.schichtId as string))).toEqual([
      404,
      "unbekannt",
    ]);
    expect(await fehler(await anbieten(c.yusuf, c.schichtId))).toEqual([403, "nicht_deine"]);
    expect(await fehler(await anbieten(c.tom, c.schichtId, c.tom.nutzerId))).toEqual([
      404,
      "person_unbekannt",
    ]);
    expect(await fehler(await anbieten(c.tom, c.schichtId, "niemand"))).toEqual([
      404,
      "person_unbekannt",
    ]);
    expect((await anbieten(c.tom, c.schichtId)).status).toBe(201);
    expect(await fehler(await anbieten(c.tom, c.schichtId))).toEqual([409, "schon_angeboten"]);
    for (const body of [{}, { schichtId: c.schichtId, grund: "krank" }])
      expect((await c.tom.anfrage(TAUSCH, { body })).status).toBe(400);
    c.server.stelleUhr(Date.parse("2026-11-23T13:00:00Z"));
    const neu = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId, "2026-11-23"));
    await c.lea.anfrage("/api/v1/dienstplan/veroeffentlichen", {
      body: { standortId: c.standortId, tag: "2026-11-23" },
    });
    expect(await fehler(await anbieten(c.tom, neu.schichtId as string))).toEqual([
      409,
      "abgelaufen",
    ]);
  });

  it("keeps an offer to a named colleague between the two and whoever plans", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId, c.yusuf.nutzerId);
    const ids = async (wer: Browser) => (await tauschbuchVon(wer)).tausche.map((t) => t.tauschId);
    expect(await ids(c.olena)).toEqual([]);
    expect(await ids(c.yusuf)).toEqual([tausch.tauschId]);
    expect(await ids(c.lea)).toEqual([tausch.tauschId]);
    expect((await schritt(c.olena, tausch.tauschId, "uebernehmen")).status).toBe(404);
    expect((await schritt(c.yusuf, tausch.tauschId, "uebernehmen")).status).toBe(200);
  });

  it("shows an offer to everyone to each colleague, and colleagues by name only", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId);
    const buch = await tauschbuchVon(c.olena);
    expect(buch.tausche.map((t) => t.tauschId)).toEqual([tausch.tauschId]);
    expect(buch.kollegen.map((k) => k.name).sort()).toEqual(
      ["Inhaber Café Elbblick", "lea", "tom", "yusuf"].sort(),
    );
    expect(Object.keys(buch.kollegen[0] ?? {}).sort()).toEqual(["name", "nutzerId"]);
    const eigenes = await tauschbuchVon(c.tom);
    expect(eigenes.anbietbar).toEqual([]);
    expect(eigenes.tausche).toEqual([
      expect.objectContaining({ tauschId: tausch.tauschId, befunde: null }),
    ]);
  });

  it("is not taken by whoever offered it nor by someone busy at that time", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId);
    expect((await schritt(c.tom, tausch.tauschId, "uebernehmen")).status).toBe(403);
    await planen(c.lea, {
      ...schichtVon(c.standortId, c.yusuf.nutzerId),
      beginnMinute: 20 * 60,
      endeMinute: 23 * 60,
    });
    await c.lea.anfrage("/api/v1/dienstplan/veroeffentlichen", {
      body: { standortId: c.standortId, tag: "2026-11-23" },
    });
    const belegt = await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    expect([belegt.status, (await json(belegt)).fehler]).toEqual([409, "ueberschneidung"]);
    expect((await schritt(c.olena, tausch.tauschId, "uebernehmen")).status).toBe(200);
    // taken once, nobody else takes it
    expect((await schritt(c.mia, tausch.tauschId, "uebernehmen")).status).toBe(409);
  });

  it("expires when the shift begins and leaves the list", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId);
    c.server.stelleUhr(Date.parse("2026-11-23T13:00:00Z"));
    const spaet = await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    expect([spaet.status, (await json(spaet)).fehler]).toEqual([409, "abgelaufen"]);
    expect((await tauschbuchVon(c.tom)).tausche).toEqual([]);
  });
});

describe("deciding a swap", () => {
  it("is for owner and planner; a refusal needs a reason both parties read", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId);
    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    for (const wer of [c.tom, c.yusuf, c.olena]) {
      expect((await schritt(wer, tausch.tauschId, "freigeben")).status).toBe(403);
      expect((await schritt(wer, tausch.tauschId, "ablehnen", { grund: "nein" })).status).toBe(403);
    }
    expect((await schritt(c.mia, tausch.tauschId, "ablehnen")).status).toBe(400);
    expect((await schritt(c.mia, tausch.tauschId, "ablehnen", { grund: " " })).status).toBe(400);
    const nein = await schritt(c.mia, tausch.tauschId, "ablehnen", { grund: "Inventur am Montag" });
    expect(await json(nein)).toMatchObject({ status: "abgelehnt", grund: "Inventur am Montag" });
    for (const wer of [c.tom, c.yusuf])
      expect((await tauschbuchVon(wer)).tausche).toEqual([
        expect.objectContaining({ status: "abgelehnt", grund: "Inventur am Montag" }),
      ]);
    expect((await tauschbuchVon(c.olena)).tausche).toEqual([]);
    expect((await personDer(c.lea, c.standortId, c.schichtId))?.nutzerId).toBe(c.tom.nutzerId);
    expect((await schritt(c.lea, tausch.tauschId, "freigeben")).status).toBe(409);
  });

  it("gives no shift to someone who left the business before the approval", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId);
    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    const organisation = await json(
      await c.mia.anfrage(
        `/api/auth/organization/get-full-organization?organizationId=${c.mia.betriebId}`,
      ),
    );
    const memberId = (organisation.members as { id: string; userId: string }[]).find(
      (m) => m.userId === c.yusuf.nutzerId,
    )?.id;
    const weg = await c.mia.anfrage("/api/auth/organization/remove-member", {
      body: { memberIdOrEmail: memberId, organizationId: c.mia.betriebId },
    });
    expect(weg.status).toBe(200);
    const frei = await schritt(c.lea, tausch.tauschId, "freigeben");
    expect([frei.status, (await json(frei)).fehler]).toEqual([404, "person_unbekannt"]);
    expect((await personDer(c.lea, c.standortId, c.schichtId))?.nutzerId).toBe(c.tom.nutzerId);
  });

  it("approves only a swap someone took over", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId);
    const frueh = await schritt(c.lea, tausch.tauschId, "freigeben");
    expect([frueh.status, (await json(frueh)).fehler]).toEqual([409, "nicht_offen"]);
  });

  it("lets only the offerer withdraw an offer nobody decided", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId);
    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    const zurueck = (wer: Browser) =>
      wer.anfrage(`${TAUSCH}/${tausch.tauschId}`, { method: "DELETE" });
    expect((await zurueck(c.yusuf)).status).toBe(403);
    expect((await zurueck(c.lea)).status).toBe(403);
    const ok = await zurueck(c.tom);
    expect(await json(ok)).toMatchObject({ status: "zurueckgezogen" });
    expect((await zurueck(c.tom)).status).toBe(409);
    expect((await schritt(c.lea, tausch.tauschId, "freigeben")).status).toBe(409);
    expect((await tauschbuchVon(c.tom)).anbietbar).toEqual([
      expect.objectContaining({ schichtId: c.schichtId }),
    ]);
  });

  it("ends when whoever plans changes or removes the shift", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId);
    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    await c.lea.anfrage(`/api/v1/dienstplan/schichten/${c.schichtId}`, {
      method: "PATCH",
      body: { beginnMinute: 15 * 60 },
    });
    expect((await tauschbuchVon(c.yusuf)).tausche).toEqual([
      expect.objectContaining({ status: "hinfaellig" }),
    ]);
    const frei = await schritt(c.lea, tausch.tauschId, "freigeben");
    expect([frei.status, (await json(frei)).fehler]).toEqual([409, "nicht_offen"]);

    const neu = await angeboten(c.tom, c.schichtId);
    await c.lea.anfrage(`/api/v1/dienstplan/schichten/${c.schichtId}`, { method: "DELETE" });
    expect((await schritt(c.yusuf, neu.tauschId, "uebernehmen")).status).toBe(409);
    expect(kettePruefen(c.server.db, c.mia.betriebId)).toEqual([]);
  });

  it("holds at once without approval when the owner set it, for owner only", async () => {
    const c = await elbblickZumTausch();
    const regel = (wer: Browser, ohneFreigabe: boolean) =>
      wer.anfrage(`${TAUSCH}/regel`, { method: "PUT", body: { ohneFreigabe } });
    expect((await regel(c.lea, true)).status).toBe(403);
    expect((await regel(c.tom, true)).status).toBe(403);
    expect((await regel(c.mia, true)).status).toBe(200);
    expect((await tauschbuchVon(c.tom)).ohneFreigabe).toBe(true);
    const tausch = await angeboten(c.tom, c.schichtId);
    expect(await json(await schritt(c.yusuf, tausch.tauschId, "uebernehmen"))).toMatchObject({
      status: "freigegeben",
      entschiedenVon: null,
    });
    expect((await personDer(c.lea, c.standortId, c.schichtId))?.nutzerId).toBe(c.yusuf.nutzerId);
    expect((await regel(c.mia, false)).status).toBe(200);
    expect((await tauschbuchVon(c.tom)).ohneFreigabe).toBe(false);
    expect(kettePruefen(c.server.db, c.mia.betriebId)).toEqual([]);
  });
});

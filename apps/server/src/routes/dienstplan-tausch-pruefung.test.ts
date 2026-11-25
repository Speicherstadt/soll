import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";
import {
  angeboten,
  elbblickZumTausch,
  schritt,
  TAUSCH,
  tauschbuchVon,
} from "./dienstplan-tausch-testhilfen.ts";
import {
  type Browser,
  json,
  planen,
  schichtVon,
  veroeffentlichen,
} from "./dienstplan-testhilfen.ts";

/*
 * The rules of S-502 for whoever takes over a shift, before it is approved (S-504): shown only to
 * whoever approves. The test clock stands on Monday 21 September 2026.
 */

const angaben = (inhaber: Browser, nutzerId: string, werte: Record<string, unknown>) =>
  inhaber.anfrage(`/api/v1/personen/${nutzerId}/angaben`, {
    method: "PUT",
    body: { geburtsdatum: null, wechselschicht: false, abruf: false, mutterschutz: [], ...werte },
  });

const regelnFuer = async (wer: Browser) =>
  (await tauschbuchVon(wer)).tausche.flatMap((t) => (t.befunde ?? []).map((b) => b.regel));

describe("the check for whoever takes over a shift", () => {
  it("names the Mutterschutz to whoever approves, never to the colleagues (Art. 9 DSGVO)", async () => {
    const c = await elbblickZumTausch();
    await angaben(c.mia, c.olena.nutzerId, { mutterschutz: [{ von: "2026-09-01", bis: null }] });
    const tausch = await angeboten(c.tom, c.schichtId);
    await schritt(c.olena, tausch.tauschId, "uebernehmen");
    const [eintrag] = (await tauschbuchVon(c.lea)).tausche;
    expect(eintrag?.befunde).toContainEqual(
      expect.objectContaining({ regel: "R-21", schwere: "verstoss" }),
    );
    expect(eintrag?.befunde?.every((b) => b.norm.includes("MuSchG"))).toBe(true);
    for (const wer of [c.tom, c.olena])
      expect((await tauschbuchVon(wer)).tausche.map((t) => t.befunde)).toEqual([null]);
    // a warning, not a refusal: whoever approves decides
    expect((await schritt(c.lea, tausch.tauschId, "freigeben")).status).toBe(200);
  });

  it("measures the rest after the taker's own late shift (§ 5 ArbZG)", async () => {
    const c = await elbblickZumTausch();
    // Yusuf works Monday 14:00 to 22:00; Tom offers Tuesday from 7:30: 9.5 hours of rest
    await planen(c.lea, schichtVon(c.standortId, c.yusuf.nutzerId));
    const frueh = await planen(c.lea, {
      ...schichtVon(c.standortId, c.tom.nutzerId, "2026-11-24"),
      beginnMinute: 7 * 60 + 30,
      endeMinute: 12 * 60,
      pauseMinuten: 0,
    });
    await veroeffentlichen(c.lea, c.standortId);
    const tausch = await angeboten(c.tom, frueh.schichtId as string);
    await schritt(c.olena, tausch.tauschId, "uebernehmen");
    expect(await regelnFuer(c.lea)).toEqual([]);
    await schritt(c.lea, tausch.tauschId, "ablehnen", { grund: "Olena hat Schule" });
    const wieder = await angeboten(c.tom, frueh.schichtId as string);
    await schritt(c.yusuf, wieder.tauschId, "uebernehmen");
    expect(await regelnFuer(c.lea)).toEqual(["R-05"]);
  });

  it("applies the JArbSchG to the apprentice Leon (17)", async () => {
    const server = testServer();
    const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
    const werkstatt = await json(
      await jonas.anfrage("/api/v1/standorte", { body: { name: "Werkstatt", land: "HH" } }),
    );
    const standortId = werkstatt.standortId as string;
    const sandra = await server.eingeladen(jonas, "mitarbeiter", "sandra");
    const leon = await server.eingeladen(jonas, "mitarbeiter", "leon");
    await angaben(jonas, leon.nutzerId, { geburtsdatum: "2009-06-01" });
    const notdienst = await planen(jonas, schichtVon(standortId, sandra.nutzerId));
    await veroeffentlichen(jonas, standortId);
    const tausch = await angeboten(sandra, notdienst.schichtId as string, leon.nutzerId);
    await schritt(leon, tausch.tauschId, "uebernehmen");
    const befunde = (await tauschbuchVon(jonas)).tausche[0]?.befunde ?? [];
    expect(befunde.length).toBeGreaterThan(0);
    expect(befunde.every((b) => b.norm.includes("JArbSchG"))).toBe(true);
  });

  it("holds without approval only while the check finds no Verstoß", async () => {
    const c = await elbblickZumTausch();
    await c.mia.anfrage(`${TAUSCH}/regel`, { method: "PUT", body: { ohneFreigabe: true } });
    await angaben(c.mia, c.olena.nutzerId, { mutterschutz: [{ von: "2026-09-01", bis: null }] });
    const tausch = await angeboten(c.tom, c.schichtId);
    expect(await json(await schritt(c.olena, tausch.tauschId, "uebernehmen"))).toMatchObject({
      status: "uebernommen",
    });
    expect(await regelnFuer(c.mia)).toContain("R-21");
  });
});

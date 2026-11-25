import { describe, expect, it } from "vitest";
import {
  angeboten,
  elbblickZumTausch,
  personDer,
  schritt,
  TAUSCH,
} from "./dienstplan-tausch-testhilfen.ts";
import { json, planen, schichtVon } from "./dienstplan-testhilfen.ts";

/* Findings of the independent review of S-504: a draft of the taker, the other person in the Auskunft */

describe("review of S-504", () => {
  it("does not swap at once onto a draft of the taker at the same time (as approval would not)", async () => {
    const c = await elbblickZumTausch();
    await c.mia.anfrage(`${TAUSCH}/regel`, { method: "PUT", body: { ohneFreigabe: true } });
    // Lea plans Yusuf a draft overlapping Tom's published 14:00-22:00 shift
    await planen(c.lea, {
      ...schichtVon(c.standortId, c.yusuf.nutzerId),
      beginnMinute: 20 * 60,
      endeMinute: 23 * 60,
    });
    const tausch = await angeboten(c.tom, c.schichtId);
    const antwort = await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    // approval by a planner would be refused with 409 "ueberschneidung" (tauschFreigeben)
    expect((await json(antwort)).status).not.toBe("freigegeben");
    expect((await personDer(c.lea, c.standortId, c.schichtId))?.nutzerId).toBe(c.tom.nutzerId);
  });

  it("keeps the other person of a swap out of the Auskunft, also in the audit chain", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId, c.yusuf.nutzerId);
    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    const auskunft = await json(await c.yusuf.anfrage("/api/v1/auskunft"));
    const kette = auskunft.auditKette as {
      zuDeinenDaten: { tabelle: string; von: string; aktion: string }[];
    };
    const tauschGlieder = kette.zuDeinenDaten.filter((g) => g.tabelle === "schichttausche");
    expect(tauschGlieder.length).toBeGreaterThan(0);
    expect(tauschGlieder.map((g) => g.von)).not.toContain("tom");
    // nor the taker or whoever decided in the offerer's
    await schritt(c.lea, tausch.tauschId, "ablehnen", { grund: "Inventur" });
    const vonTom = (await json(await c.tom.anfrage("/api/v1/auskunft"))).auditKette as {
      zuDeinenDaten: { tabelle: string; von: string }[];
    };
    const namen = vonTom.zuDeinenDaten
      .filter((g) => g.tabelle === "schichttausche")
      .map((g) => g.von);
    expect(namen).toContain("tom");
    for (const fremd of ["yusuf", "lea"]) expect(namen).not.toContain(fremd);
  });
});

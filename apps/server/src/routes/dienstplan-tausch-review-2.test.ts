import { describe, expect, it } from "vitest";
import { angeboten, elbblickZumTausch, schritt, TAUSCH } from "./dienstplan-tausch-testhilfen.ts";
import { json } from "./dienstplan-testhilfen.ts";

/*
 * Second review of S-504: the change of a shift's person written by a swap names neither the earlier
 * holder nor whoever approved it in the Auskunft of a later holder; ordinary planning keeps its name
 */

type Glied = { tabelle: string; von: string };

const kette = async (wer: { anfrage: (pfad: string) => Promise<Response> }) =>
  ((await json(await wer.anfrage("/api/v1/auskunft"))).auditKette as { zuDeinenDaten: Glied[] })
    .zuDeinenDaten;

describe("second review of S-504", () => {
  it("names no earlier party of a swap through the links on the shift itself", async () => {
    const c = await elbblickZumTausch();
    await c.mia.anfrage(`${TAUSCH}/regel`, { method: "PUT", body: { ohneFreigabe: true } });
    const erst = await angeboten(c.tom, c.schichtId);
    expect((await json(await schritt(c.yusuf, erst.tauschId, "uebernehmen"))).status).toBe(
      "freigegeben",
    );
    const zweit = await angeboten(c.yusuf, c.schichtId, c.olena.nutzerId);
    expect((await json(await schritt(c.olena, zweit.tauschId, "uebernehmen"))).status).toBe(
      "freigegeben",
    );
    const glieder = await kette(c.olena);
    expect(glieder.map((g) => g.von)).not.toContain("yusuf");
    // her own takeover keeps her name
    const schicht = glieder.filter((g) => g.tabelle === "schichten").map((g) => g.von);
    expect(schicht).toEqual(["lea", "lea", "eine andere Person", "olena"]);
  });

  it("names not whoever approved, but still who planned and published the shift", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId);
    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    await schritt(c.lea, tausch.tauschId, "freigeben");
    const schicht = (await kette(c.yusuf)).filter((g) => g.tabelle === "schichten");
    expect(schicht.map((g) => g.von)).toEqual(["lea", "lea", "eine andere Person"]);
  });
});

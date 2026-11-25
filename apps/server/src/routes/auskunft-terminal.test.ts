import { describe, expect, it } from "vitest";
import { type Json, json, weber } from "./monat-testhilfen.ts";

/** The person's QR code for the terminal (S-801) in the Auskunft (S-309) */
describe("GET /api/v1/auskunft with the terminal", () => {
  it("says when and by whom the person's QR code was issued, without its value or hash", async () => {
    const w = await weber();
    await w.jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
    const ausgestellt = await w.jonas.anfrage(`/api/v1/terminal/ausweise/${w.sandra.nutzerId}`, {
      body: {},
    });
    expect(ausgestellt.status).toBe(201);
    const { wert } = await json(ausgestellt);
    await w.jonas.anfrage("/api/v1/terminal/geraete", { body: { name: "Werkstatt" } });

    const antwort = await w.sandra.anfrage("/api/v1/auskunft");
    const text = await antwort.clone().text();
    const eigen = await json(antwort);
    expect(eigen.ausweis).toEqual({
      ausgestelltAm: expect.any(String),
      ausgestelltVon: "Inhaber Weber Haustechnik",
    });
    expect(text).not.toContain(wert as string);
    expect(text).not.toContain("tokenHash");
    expect(text).not.toContain("Werkstatt");
    const kette = eigen.auditKette as { zuDeinenDaten: Json[] };
    expect(kette.zuDeinenDaten.map((g) => g.tabelle)).toContain("ausweise");

    // the owner issued it and sees it in the settings, so his copy for Sandra holds it too
    const inhaber = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(inhaber.ausweis).toEqual(eigen.ausweis);
  });

  it("names no QR code where none was issued", async () => {
    const w = await weber();
    expect((await json(await w.sandra.anfrage("/api/v1/auskunft"))).ausweis).toBeNull();
  });
});

/** The person's NFC cards (S-802) in the Auskunft */
describe("GET /api/v1/auskunft with NFC cards", () => {
  it("names the person's cards with kind and dates, without UID, keys or counter", async () => {
    const w = await weber();
    await w.jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
    const eingetragen = await w.jonas.anfrage("/api/v1/terminal/karten", {
      body: {
        nutzerId: w.sandra.nutzerId,
        art: "ntag424",
        uid: "041D3C8A2D6B80",
        meta: "42AFF114F2CB3B6141BE6DC95DFC5416",
        datei: "B62A9BAF092439BD43C62AEE96B970C5",
      },
    });
    expect(eingetragen.status).toBe(201);
    const antwort = await w.sandra.anfrage("/api/v1/auskunft");
    const text = (await antwort.clone().text()).toUpperCase();
    const eigen = await json(antwort);
    expect(eigen.karten).toEqual([
      {
        karteId: expect.any(String),
        art: "ntag424",
        eingetragenAm: expect.any(String),
        eingetragenVon: "Inhaber Weber Haustechnik",
        widerrufenAm: null,
      },
    ]);
    for (const geheim of ["041D3C8A2D6B80", "42AFF114F2CB3B61", "B62A9BAF092439BD", "UIDKENNUNG"])
      expect(text).not.toContain(geheim);
    const kette = eigen.auditKette as { zuDeinenDaten: Json[] };
    expect(kette.zuDeinenDaten.map((g) => g.tabelle)).toContain("karten");
    const inhaber = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(inhaber.karten).toEqual(eigen.karten);
  });
});

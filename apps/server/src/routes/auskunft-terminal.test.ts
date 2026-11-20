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

import { describe, expect, it } from "vitest";
import { abgeschlossen } from "./monat-testhilfen.ts";

/** Weber with Sandra's October closed, and Café Elbblick with Mia */
const zwei = async () => {
  const weber = await abgeschlossen();
  const mia = await weber.server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  return { ...weber, mia };
};

describe("no business sees another's Prüfexport", () => {
  for (const format of ["csv", "pdf"]) {
    it(`GET /api/v1/arbeitszeit/pruefexport (${format}) does not reach a person of another business`, async () => {
      const { mia, sandra } = await zwei();
      const antwort = await mia.anfrage(
        `/api/v1/arbeitszeit/pruefexport?format=${format}&von=2026-10-01&bis=2026-10-31&nutzerId=${sandra.nutzerId}`,
      );
      expect(antwort.status).toBe(404);
    });
  }

  it("GET /api/v1/arbeitszeit/pruefexport gives Mia her own business's days only", async () => {
    const { mia } = await zwei();
    const antwort = await mia.anfrage(
      "/api/v1/arbeitszeit/pruefexport?format=csv&von=2026-10-01&bis=2026-10-31",
    );
    expect(antwort.status).toBe(200);
    const text = await antwort.text();
    expect(text.split("\r\n").filter(Boolean)).toHaveLength(1);
    expect(text).not.toContain("sandra");
    expect(text).not.toContain("Nr. ");
  });
});

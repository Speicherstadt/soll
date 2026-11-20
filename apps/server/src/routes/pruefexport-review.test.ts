import { describe, expect, it } from "vitest";
import { weber } from "./monat-testhilfen.ts";

describe("Prüfexport: changes to a night shift (review of S-309)", () => {
  it("shows the removal of a night shift's Gehen after midnight on the day the shift began", async () => {
    const w = await weber();
    const entfernt = await w.sandra.anfrage(
      `/api/v1/arbeitszeit/stempelungen/${w.ids.nachtGehen}/entfernen`,
      { body: { grund: "doppelt" } },
    );
    expect(entfernt.status).toBeLessThan(300);
    const antwort = await w.jonas.anfrage(
      `/api/v1/arbeitszeit/pruefexport?format=csv&von=2026-10-01&bis=2026-11-30&nutzerId=${w.sandra.nutzerId}`,
    );
    const zeilen = (await antwort.text()).split("\r\n");
    const nacht = zeilen.find((z) => z.includes(";31.10.2026;")) ?? "";
    expect(nacht).toContain("Grund: doppelt");
    expect(zeilen.find((z) => z.includes(";01.11.2026;"))).toBeUndefined();
  });
});

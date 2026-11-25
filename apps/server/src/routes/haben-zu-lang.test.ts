import { describe, expect, it } from "vitest";
import { mitHaben, uebergeben } from "./haben-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";
import { starten, stoppen, um } from "./stoppuhr-testhilfen.ts";

/**
 * docs/api.md of Haben, "Leistungen": `minutes` 1 to 1440 (serviceEntryCreateSchema). The stopwatch
 * has no cap (a manual booking is capped at LAENGSTE_SCHICHT, `spanne`): one left running over a
 * weekend has more than 1440 minutes. Billed, it would be locked and refused by Haben on every try,
 * with no way back ("ein Zurücknehmen gibt es nicht"): the transfer refuses it (`422 zu_lang`).
 */
describe("a booking Haben cannot take (over 1440 minutes)", () => {
  it("is not billed and locked for Haben", async () => {
    const w = await mitHaben();
    w.server.stelleUhr(um("16:00"));
    const gestartet = await starten(w.weber, {
      projektId: w.projekt.projektId,
      taetigkeitId: w.montage.taetigkeitId,
    });
    expect(gestartet.status).toBe(201);
    const buchungId = ((await json(gestartet)).laufend as { buchungId: string }).buchungId;
    w.server.stelleUhr(um("17:00", "2026-11-21"));
    expect((await stoppen(w.weber)).status).toBe(200);
    const antwort = await uebergeben(w.weber, [buchungId]);
    // refused before billing, not left billed and undeliverable
    expect(antwort.status).toBe(422);
    expect(await json(antwort)).toEqual({ fehler: "zu_lang" });
    expect(w.haben.leistungen()).toEqual([]);
    const buchung = w.server.sqlite
      .query("SELECT abgerechnet_am AS am FROM projektzeiten WHERE buchung_id = ?")
      .get(buchungId) as { am: number | null };
    expect(buchung.am).toBeNull();
  });
});

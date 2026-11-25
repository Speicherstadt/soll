import { describe, expect, it } from "vitest";
import { mitHaben, uebergeben } from "./haben-testhilfen.ts";
import { PZ } from "./projektzeit-testhilfen.ts";

/**
 * docs/plan.md, "Keine Leistung doppelt": "die gesperrte Buchung schickt bei jeder Wiederholung
 * denselben Inhalt". A booking billed for Haben whose first send failed must go on retry as it was
 * billed, not as the activity is set today.
 */
describe("a retry sends the Leistung as it was billed (S-606)", () => {
  it("a non-billable booking stays nonBillable after its activity is switched to billable", async () => {
    const w = await mitHaben();
    w.haben.stoeren("netz");
    await uebergeben(w.weber, [w.jonasFahrt.buchungId]);
    expect(w.haben.leistungen()).toEqual([]);
    // billed (rate frozen: none, Fahrt is not billed); now the business starts billing Fahrt
    const umgestellt = await w.weber.anfrage(`${PZ}/taetigkeiten/fahrt`, {
      method: "PATCH",
      body: { abrechenbar: true },
    });
    expect(umgestellt.status).toBe(200);
    await uebergeben(w.weber, [w.jonasFahrt.buchungId]);
    expect(w.haben.leistungen()).toHaveLength(1);
    expect(w.haben.leistungen()[0]).toMatchObject({ nonBillable: true });
  });
});

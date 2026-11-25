import { describe, expect, it } from "vitest";
import { mitHaben, uebergeben } from "./haben-testhilfen.ts";
import { tageFrage, unterschreiben } from "./stundennachweis-testhilfen.ts";

/**
 * docs/plan.md, "Stundennachweis und Haben": "jede Leistung nennt ihren Nachweis im Text". A booking
 * billed for Haben whose send failed, then signed in a Stundennachweis, is sent on retry from the
 * stored inhalt, which was frozen before the signature: Haben never learns the number.
 */
describe("a Stundennachweis signed between billing and a successful send", () => {
  it("the Leistung Haben finally gets names the Stundennachweis", async () => {
    const w = await mitHaben();
    w.haben.stoeren("netz");
    await uebergeben(w.weber, [w.sandraMontage.buchungId]);
    expect(w.haben.leistungen()).toEqual([]);
    const signiert = await unterschreiben(w.weber, tageFrage(w.projekt.projektId));
    expect(signiert.status).toBe(201);
    await uebergeben(w.weber, [w.sandraMontage.buchungId]);
    expect(w.haben.leistungen()).toHaveLength(1);
    expect(w.haben.leistungen()[0]?.description).toBe(
      "Montage: Vorwand gesetzt (Stundennachweis Nr. 1)",
    );
  });
});

import { describe, expect, it } from "vitest";
import { elbblickMitBoten, planen, schichtVon, veroeffentlichen } from "./dienstplan-testhilfen.ts";

/*
 * The service worker shows each push with its tag, and a notification with the same tag replaces
 * the one before (apps/web/build/service-worker.ts): messages about different shifts or weeks must
 * not share one (review of S-503)
 */

describe("messages about two changed shifts", () => {
  it("do not share a notification tag, so the device keeps both", async () => {
    const c = await elbblickMitBoten();
    await c.abonnieren(c.tom, "tom");
    const montag = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId, "2026-11-23"));
    const mittwoch = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId, "2026-11-25"));
    await veroeffentlichen(c.lea, c.standortId);
    c.zugestellt.length = 0;
    for (const { schichtId } of [montag, mittwoch])
      await c.lea.anfrage(`/api/v1/dienstplan/schichten/${schichtId}`, {
        method: "PATCH",
        body: { beginnMinute: 15 * 60 },
      });
    const tags = c.zugestellt.map((z) => (z.inhalt as { tag: string }).tag);
    expect(tags).toHaveLength(2);
    expect(new Set(tags).size).toBe(2);
  });

  it("use the shift's own tag for its change and its removal", async () => {
    const c = await elbblickMitBoten();
    await c.abonnieren(c.tom, "tom");
    const schicht = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId));
    await veroeffentlichen(c.lea, c.standortId);
    c.zugestellt.length = 0;
    const pfad = `/api/v1/dienstplan/schichten/${schicht.schichtId}`;
    await c.lea.anfrage(pfad, { method: "PATCH", body: { beginnMinute: 15 * 60 } });
    await c.lea.anfrage(pfad, { method: "DELETE" });
    expect(c.zugestellt.map((z) => (z.inhalt as { tag: string }).tag)).toEqual([
      `plan-${schicht.schichtId}`,
      `plan-${schicht.schichtId}`,
    ]);
  });
});

describe("messages about two published weeks", () => {
  it("do not share a tag across weeks or sites", async () => {
    const c = await elbblickMitBoten();
    await c.abonnieren(c.tom, "tom");
    const hafen = (await (
      await c.mia.anfrage("/api/v1/standorte", { body: { name: "Hafen", land: "HH" } })
    ).json()) as { standortId: string };
    await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId, "2026-11-23"));
    await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId, "2026-11-30"));
    await planen(c.lea, schichtVon(hafen.standortId, c.tom.nutzerId, "2026-11-24"));
    await veroeffentlichen(c.lea, c.standortId, "2026-11-23");
    await veroeffentlichen(c.lea, c.standortId, "2026-11-30");
    await veroeffentlichen(c.lea, hafen.standortId, "2026-11-23");
    const tags = c.zugestellt.map((z) => (z.inhalt as { tag: string }).tag);
    expect(tags).toEqual([
      `plan-${c.standortId}-2026-11-23`,
      `plan-${c.standortId}-2026-11-30`,
      `plan-${hafen.standortId}-2026-11-23`,
    ]);
  });
});

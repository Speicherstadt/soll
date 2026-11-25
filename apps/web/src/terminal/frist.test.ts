import { afterEach, describe, expect, it, vi } from "vitest";
import type { Antwort } from "../api.ts";
import { FRIST_MS } from "./frist.ts";
import { kioskAnfrage } from "./geraet.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a kiosk call to a server that does not answer (review of S-803, round 4)", () => {
  it("counts as no network after FRIST_MS, so the kiosk goes on", async () => {
    vi.useFakeTimers();
    // Wi-Fi up, the server silent: fetch stays pending
    vi.stubGlobal("fetch", () => new Promise<Response>(() => undefined));
    let antwort: Antwort<unknown> | undefined;
    void kioskAnfrage("t", "/erkennen", { sun: { e: "x", c: "y" } }).then((a) => {
      antwort = a;
    });
    await vi.advanceTimersByTimeAsync(FRIST_MS - 1000);
    expect(antwort).toBeUndefined();
    await vi.advanceTimersByTimeAsync(2000);
    expect(antwort?.status).toBe(0);
  });

  it("gives the answer that comes in time", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ name: "Eingang" }), { status: 200 }),
    );
    expect(await kioskAnfrage("t", "")).toEqual({
      ok: true,
      status: 200,
      daten: { name: "Eingang" },
    });
  });
});

import { describe, expect, it } from "vitest";
import { bilderZeit } from "./server.ts";

describe("the clock of the screenshots (S-908)", () => {
  it("stands at 10:45 in Europe/Berlin, in winter and in summer time", () => {
    expect(new Date(bilderZeit("2026-11-25")).toISOString()).toBe("2026-11-25T09:45:00.000Z");
    expect(new Date(bilderZeit("2026-07-01")).toISOString()).toBe("2026-07-01T08:45:00.000Z");
  });
});

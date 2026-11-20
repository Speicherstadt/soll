import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.ts";

describe("parseEnv", () => {
  it("fills in the defaults", () => {
    expect(parseEnv({})).toEqual({
      port: 8200,
      host: "0.0.0.0",
      version: "0.0.0",
      dataDir: "data",
    });
  });

  it("reads the port as a number", () => {
    expect(parseEnv({ SOLL_PORT: "28200" }).port).toBe(28200);
  });

  it("refuses a port out of range", () => {
    expect(() => parseEnv({ SOLL_PORT: "70000" })).toThrow();
  });
});

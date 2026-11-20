import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.ts";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("parseEnv", () => {
  it("fills in the defaults", () => {
    expect(parseEnv({ SOLL_SECRET_KEY: KEY })).toMatchObject({
      port: 8200,
      host: "0.0.0.0",
      version: "0.0.0",
      dataDir: "data",
      url: "http://localhost:8200",
    });
  });

  it("reads the port as a number", () => {
    expect(parseEnv({ SOLL_PORT: "28200", SOLL_SECRET_KEY: KEY }).port).toBe(28200);
  });

  it("refuses a port out of range", () => {
    expect(() => parseEnv({ SOLL_PORT: "70000", SOLL_SECRET_KEY: KEY })).toThrow();
  });

  it("decodes SOLL_SECRET_KEY into 32 bytes", () => {
    expect(parseEnv({ SOLL_SECRET_KEY: KEY }).geheimerSchluessel).toEqual(
      new Uint8Array(32).fill(7),
    );
  });

  it("refuses to start without SOLL_SECRET_KEY", () => {
    expect(() => parseEnv({})).toThrow(/SOLL_SECRET_KEY/);
  });

  it("refuses a key of another length or not in base64", () => {
    expect(() => parseEnv({ SOLL_SECRET_KEY: Buffer.alloc(16).toString("base64") })).toThrow(
      /32 bytes/,
    );
    expect(() => parseEnv({ SOLL_SECRET_KEY: "kein-schluessel!" })).toThrow(/32 bytes/);
  });
});

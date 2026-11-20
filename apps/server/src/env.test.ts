import { describe, expect, it } from "vitest";
import { parseBetriebsEnv, parseEnv } from "./env.ts";

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

  it("drops a trailing slash of SOLL_URL, so invitation links have no double slash", () => {
    expect(parseEnv({ SOLL_SECRET_KEY: KEY, SOLL_URL: "https://soll.example/" }).url).toBe(
      "https://soll.example",
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

  it("reads SMTP for mail only with a sender, and none without both", () => {
    expect(parseEnv({ SOLL_SECRET_KEY: KEY }).smtp).toBeNull();
    expect(
      parseEnv({
        SOLL_SECRET_KEY: KEY,
        SOLL_SMTP_URL: "smtps://soll:geheim@mail.betrieb.test:465",
        SOLL_MAIL_VON: "Soll <soll@betrieb.test>",
      }).smtp,
    ).toEqual({
      url: "smtps://soll:geheim@mail.betrieb.test:465",
      von: "Soll <soll@betrieb.test>",
    });
    expect(() =>
      parseEnv({ SOLL_SECRET_KEY: KEY, SOLL_SMTP_URL: "smtp://mail.betrieb.test:25" }),
    ).toThrow(/SOLL_SMTP_URL and SOLL_MAIL_VON/);
    expect(() =>
      parseEnv({ SOLL_SECRET_KEY: KEY, SOLL_SMTP_URL: "http://x.test", SOLL_MAIL_VON: "a@b.test" }),
    ).toThrow();
  });
});

describe("SOLL_WEB_DIR", () => {
  it("is null unless set, then the directory of the web build", () => {
    expect(parseEnv({ SOLL_SECRET_KEY: KEY }).webDir).toBeNull();
    expect(parseEnv({ SOLL_SECRET_KEY: KEY, SOLL_WEB_DIR: "/app/web" }).webDir).toBe("/app/web");
  });
});

describe("parseBetriebsEnv", () => {
  it("reads port and data directory without SOLL_SECRET_KEY", () => {
    expect(parseBetriebsEnv({})).toEqual({ port: 8200, dataDir: "data" });
    expect(parseBetriebsEnv({ SOLL_PORT: "8300", SOLL_DATA_DIR: "/data" })).toEqual({
      port: 8300,
      dataDir: "/data",
    });
  });
});

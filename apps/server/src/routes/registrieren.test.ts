import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";

describe("signing up", () => {
  it("needs a password of at least 10 characters, as an invitation does", async () => {
    const server = testServer();
    const b = server.browser();
    const kurz = await b.anfrage("/api/auth/sign-up/email", {
      body: { email: "mia@elbblick.test", password: "neun-zch9", name: "Mia" },
    });
    expect(kurz.status).toBe(400);
    const lang = await b.anfrage("/api/auth/sign-up/email", {
      body: { email: "mia@elbblick.test", password: "zehn-zch10", name: "Mia" },
    });
    expect(lang.status).toBe(200);
  });

  it("leaves a new account without a business until it creates one", async () => {
    const server = testServer();
    const b = server.browser();
    await b.anfrage("/api/auth/sign-up/email", {
      body: { email: "mia@elbblick.test", password: "geheim-geheim-123", name: "Mia" },
    });
    const betrieb = await b.anfrage("/api/v1/betrieb");
    expect(betrieb.status).toBe(403);
    expect(await betrieb.json()).toEqual({ fehler: "kein_betrieb" });
  });
});

import { describe, expect, it } from "vitest";
import { type Json, json, weber } from "./monat-testhilfen.ts";

describe("Auskunft given by the owner for someone else (review of S-309)", () => {
  it("does not hand the owner the person's sign-in addresses, browsers or sign-in methods", async () => {
    const w = await weber();
    // Better Auth keeps the address and browser of each sign-in; the test requests send neither
    w.server.sqlite
      .query("UPDATE session SET ip_address = ?, user_agent = ? WHERE user_id = ?")
      .run("203.0.113.77", "Sandras-Handy/1.0", w.sandra.nutzerId);
    // her own copy holds them (Art. 15 DSGVO)
    const eigen = await (await w.sandra.anfrage("/api/v1/auskunft")).text();
    expect(eigen).toContain("203.0.113.77");
    // the owner never sees them otherwise; the employer is not to learn where she signs in from
    const antwort = await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`);
    expect(antwort.status).toBe(200);
    const text = await antwort.clone().text();
    expect(text).not.toContain("203.0.113.77");
    expect(text).not.toContain("Sandras-Handy");
    // the sign-in methods belong to her account across businesses, not to this business
    expect((await json(antwort)).anmeldung as Json | undefined).toBeUndefined();
  });
});

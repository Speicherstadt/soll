import { describe, expect, it } from "vitest";
import { testAbo } from "../modules/erinnerungen/push-test.ts";
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

describe("Auskunft given by the owner for someone else (second review of S-309)", () => {
  it("leaves out the person's reminder wishes, sent reminders and push devices, and keeps them in her own copy", async () => {
    const w = await weber();
    const abo = testAbo("https://fcm.googleapis.com/fcm/send/sandra").json;
    const pfad = "/api/v1/arbeitszeit/erinnerungen";
    expect(
      (await w.sandra.anfrage(`${pfad}/abos`, { body: { ...abo, sprache: "pl" } })).status,
    ).toBeLessThan(300);
    const wuensche = { ausstempeln: false, pause: true, monat: true, mail: false };
    expect(
      (await w.sandra.anfrage(`${pfad}/wuensche`, { method: "PUT", body: wuensche })).status,
    ).toBeLessThan(300);
    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    expect(eigen.erinnerungseinstellungen).toEqual(wuensche);
    expect(eigen.pushAbos as Json[]).toHaveLength(1);
    const eigeneKette = eigen.auditKette as { zuDeinenDaten: Json[]; vonDir: Json[] };
    expect(eigeneKette.vonDir.map((g) => g.tabelle)).toContain("pushAbos");
    // the owner sees neither anywhere else in Soll: which reminders she switched off, on how many
    // devices and in which language she uses the app, and when she set them up (docs/plan.md)
    const fremd = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(fremd.erinnerungseinstellungen).toBeUndefined();
    expect(fremd.erinnerungen).toBeUndefined();
    expect(fremd.pushAbos).toBeUndefined();
    const kette = fremd.auditKette as { zuDeinenDaten: Json[]; vonDir: Json[] };
    const tabellen = [...kette.zuDeinenDaten, ...kette.vonDir].map((g) => g.tabelle);
    for (const t of ["pushAbos", "erinnerungseinstellungen", "erinnerungen"])
      expect(tabellen, t).not.toContain(t);
    // her records of working time stay complete in the owner's copy
    expect(fremd.stempelungen as Json[]).toHaveLength(6);
    expect(tabellen).toContain("stempelungen");
  });
});

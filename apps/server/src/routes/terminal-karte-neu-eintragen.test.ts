import { describe, expect, it } from "vitest";
import { ntagKarte, sun } from "./karten-testhilfen.ts";
import {
  betriebMitTerminal,
  gekoppelt,
  json,
  neuerServer,
  pinSetzen,
} from "./terminal-testhilfen.ts";

/** Café Elbblick with Lea and Tom, a paired tablet */
const elbblick = async () => {
  const server = neuerServer();
  const { inhaber, mitarbeiterin: lea } = await betriebMitTerminal(server);
  const tom = await server.eingeladen(inhaber, "mitarbeiter", "tom");
  await pinSetzen(inhaber, tom.nutzerId, "583920");
  const geraet = await gekoppelt(server, inhaber);
  const erkennen = (body: unknown) => geraet.anfrage("/api/v1/kiosk/erkennen", { body });
  return { server, inhaber, lea, tom, geraet, erkennen };
};

type Glied = { tabelle: string; aktion: string; zeitpunkt: string };

describe("a revoked card entered again for another person (S-802)", { timeout: 20_000 }, () => {
  it("stays in the first person's Auskunft and out of the second's", async () => {
    const e = await elbblick();
    const { karteId } = await ntagKarte(e.inhaber, e.lea.nutzerId);
    // Lea uses her card at the terminal: a link on the card's row with the time of her read
    e.server.stelleUhr(Date.parse("2026-11-20T08:13:00+01:00"));
    expect((await e.erkennen({ sun: sun(5) })).status).toBe(200);
    await e.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, { method: "DELETE" });
    e.server.stelleUhr(Date.parse("2026-11-21T09:00:00+01:00"));
    const neu = await ntagKarte(e.inhaber, e.tom.nutzerId);
    expect(neu.karteId).not.toBe(karteId);

    const lea = await json(await e.lea.anfrage("/api/v1/auskunft"));
    expect((lea.karten as unknown[]).length).toBe(1); // her (revoked) card

    const tom = await json(await e.tom.anfrage("/api/v1/auskunft"));
    const kartenglieder = (tom.auditKette as { zuDeinenDaten: Glied[] }).zuDeinenDaten.filter(
      (g) => g.tabelle === "karten",
    );
    // Tom's copy must not carry the time Lea stamped in with the card (Art. 15 Abs. 4 DSGVO)
    expect(kartenglieder.map((g) => g.zeitpunkt)).not.toContain(
      new Date(Date.parse("2026-11-20T08:13:00+01:00")).toISOString(),
    );
    expect(kartenglieder.length).toBe(1);
  });

  it("keeps the read counter across new entries and still refuses a UID in use", async () => {
    const e = await elbblick();
    const { karteId } = await ntagKarte(e.inhaber, e.lea.nutzerId);
    expect((await e.erkennen({ sun: sun(7) })).status).toBe(200);
    await e.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, { method: "DELETE" });
    const tom = await ntagKarte(e.inhaber, e.tom.nutzerId);
    expect((await e.erkennen({ sun: sun(7) })).status).toBe(401);
    expect((await e.erkennen({ sun: sun(8) })).status).toBe(200);
    // Entered a third time: the counter of the latest card holds, not the first one's
    await e.inhaber.anfrage(`/api/v1/terminal/karten/${tom.karteId}`, { method: "DELETE" });
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    expect((await e.erkennen({ sun: sun(8) })).status).toBe(401);
    const doppelt = await e.inhaber.anfrage("/api/v1/terminal/karten", {
      body: { nutzerId: e.tom.nutzerId, art: "uid", uid: "041D3C8A2D6B80" },
    });
    expect(doppelt.status).toBe(409);
    expect(
      e.server.sqlite.query("SELECT COUNT(*) AS n FROM karten WHERE widerrufen_am IS NULL").get(),
    ).toEqual({ n: 1 });
  });
});

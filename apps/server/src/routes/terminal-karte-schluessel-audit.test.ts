import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { entschluesseln } from "../modules/geheim/index.ts";
import { ntagKarte, sun, uidKarte } from "./karten-testhilfen.ts";
import { betriebMitTerminal, gekoppelt, neuerServer } from "./terminal-testhilfen.ts";

/** Café Elbblick with Lea and a paired tablet */
const elbblick = async () => {
  const server = neuerServer();
  const { inhaber, mitarbeiterin: lea } = await betriebMitTerminal(server);
  const geraet = await gekoppelt(server, inhaber);
  const erkennen = (body: unknown) => geraet.anfrage("/api/v1/kiosk/erkennen", { body });
  return { server, inhaber, lea, erkennen };
};

type Inhalt = { betriebId: string; karteId: string; schluessel: string | null };

/** Every stored content of the chain for this card that still decrypts to its keys */
const lesbareSchluessel = (
  server: Awaited<ReturnType<typeof elbblick>>["server"],
  karteId: string,
) =>
  (server.sqlite.query("SELECT inhalt FROM audit_inhalte").all() as { inhalt: string }[])
    .map((z) => JSON.parse(z.inhalt) as Inhalt | null)
    .filter((z): z is Inhalt => z?.karteId === karteId && typeof z.schluessel === "string")
    .map((z) =>
      entschluesseln(
        server.geheimerSchluessel,
        `karte:${z.betriebId}:${z.karteId}`,
        z.schluessel as string,
      ),
    )
    .filter((r) => r.ok);

describe("revoking an NTAG 424 DNA deletes its keys everywhere (S-802)", {
  timeout: 20_000,
}, () => {
  it("removes them from the stored contents of the audit chain too", async () => {
    const e = await elbblick();
    const { karteId } = await ntagKarte(e.inhaber, e.lea.nutzerId);
    await e.erkennen({ sun: sun(5) });
    expect(lesbareSchluessel(e.server, karteId).length).toBeGreaterThan(0);
    await e.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, { method: "DELETE" });
    expect(lesbareSchluessel(e.server, karteId)).toEqual([]);
  });

  it("keeps every link of the card, and the chain still verifies", async () => {
    const e = await elbblick();
    const { karteId } = await ntagKarte(e.inhaber, e.lea.nutzerId);
    await e.erkennen({ sun: sun(5) });
    await e.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, { method: "DELETE" });
    expect(
      e.server.sqlite
        .query("SELECT aktion FROM audit_glieder WHERE tabelle = 'karten' ORDER BY seq")
        .all(),
    ).toEqual([{ aktion: "einfuegen" }, { aktion: "aendern" }, { aktion: "aendern" }]);
    const betriebId = (
      e.server.sqlite.query("SELECT betrieb_id FROM karten").get() as { betrieb_id: string }
    ).betrieb_id;
    expect(kettePruefen(e.server.db, betriebId)).toEqual([]);
  });

  it("keeps the contents of a plain card, which has no keys", async () => {
    const e = await elbblick();
    const { karteId } = await uidKarte(e.inhaber, e.lea.nutzerId);
    const vorher = e.server.sqlite.query("SELECT COUNT(*) AS n FROM audit_inhalte").get();
    await e.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, { method: "DELETE" });
    const nachher = e.server.sqlite.query("SELECT COUNT(*) AS n FROM audit_inhalte").get() as {
      n: number;
    };
    expect(nachher.n).toBe((vorher as { n: number }).n + 1);
  });
});

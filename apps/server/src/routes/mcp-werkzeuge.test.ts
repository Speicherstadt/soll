import { describe, expect, it } from "vitest";
import { mcp, rpc, werkzeug } from "./mcp-testhilfen.ts";
import { json, tokenVon, weberMitSandra } from "./zugaenge-testhilfen.ts";

/** The tools go through /api/v1 with the caller's token: same rights, switches and business */

const mitToken = async () => {
  const w = await weberMitSandra();
  const { token } = await tokenVon(w.sandra);
  return { ...w, token, senden: mcp(w.server, token) };
};

const aufrufen = async (
  senden: ReturnType<typeof mcp>,
  name: string,
  args: Record<string, unknown> = {},
) => {
  const antwort = await senden(werkzeug(name, args));
  expect(antwort.status).toBe(200);
  return (await rpc(antwort)).result as {
    content: { type: string; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError: boolean;
  };
};

describe("the MCP tools", () => {
  it("read the day as the API gives it, as text and as structured content", async () => {
    const { server, token, senden } = await mitToken();
    const ergebnis = await aufrufen(senden, "tag_lesen", { datum: "2026-09-21" });
    expect(ergebnis.isError).toBe(false);
    const direkt = await json(
      await server.app.request("http://localhost:28200/api/v1/arbeitszeit/tag?datum=2026-09-21", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(ergebnis.structuredContent).toEqual(direkt);
    expect(JSON.parse(ergebnis.content[0]?.text ?? "")).toEqual(direkt);
  });

  it("stamp for the token's person with the source api", async () => {
    const { sandra, senden } = await mitToken();
    const ergebnis = await aufrufen(senden, "stempeln", { art: "kommen" });
    expect(ergebnis).toMatchObject({
      isError: false,
      structuredContent: { art: "kommen", quelle: "api" },
    });
    const tag = await json(await sandra.anfrage("/api/v1/arbeitszeit/tag"));
    expect(tag.stempelungen).toEqual([expect.objectContaining({ art: "kommen", quelle: "api" })]);
  });

  it("carry the role's rights: a fitter reads no one else's month", async () => {
    const { jonas, senden } = await mitToken();
    const ergebnis = await aufrufen(senden, "monat_lesen", {
      monat: "2026-09",
      nutzerId: jonas.nutzerId,
    });
    expect(ergebnis).toMatchObject({
      isError: true,
      structuredContent: { fehler: "keine_berechtigung" },
    });
  });

  it("are refused while their module is off", async () => {
    const { senden } = await mitToken();
    const ergebnis = await aufrufen(senden, "kunden_lesen");
    expect(ergebnis).toMatchObject({
      isError: true,
      structuredContent: { fehler: "modul_aus", modul: "projektzeit" },
    });
  });

  it("report wrong input as a tool error and an unknown tool as -32602", async () => {
    const { senden } = await mitToken();
    const falsch = await aufrufen(senden, "stempeln", { art: "feierabend" });
    expect(falsch.isError).toBe(true);
    expect(falsch.content[0]?.text).toMatch(/^Ungültige Eingabe/);
    const zuViel = await aufrufen(senden, "tag_lesen", { datum: "2026-09-21", rolle: "inhaber" });
    expect(zuViel.isError).toBe(true);
    const unbekannt = await rpc(await senden(werkzeug("loeschen")));
    expect(unbekannt.error?.code).toBe(-32602);
  });

  it("never reach another business: Elbblick's token does not read Sandra's day", async () => {
    const { server, sandra } = await mitToken();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const { token } = await tokenVon(mia);
    const ergebnis = await aufrufen(mcp(server, token), "tag_lesen", { nutzerId: sandra.nutzerId });
    expect(ergebnis).toMatchObject({ isError: true, structuredContent: { fehler: "unbekannt" } });
    const betrieb = await aufrufen(mcp(server, token), "betrieb_lesen");
    expect(betrieb.structuredContent).toMatchObject({ name: "Café Elbblick" });
  });

  it("count once each against the token's limit of 120 a minute", async () => {
    const { senden } = await mitToken();
    for (let i = 0; i < 120; i++)
      expect((await senden(werkzeug("betrieb_lesen"))).status).toBe(200);
    const zuViele = await senden(werkzeug("betrieb_lesen"));
    expect(zuViele.status).toBe(429);
    expect(zuViele.headers.get("retry-after")).toBe("60");
  });

  it("stop at once when the person leaves the business", async () => {
    const { jonas, sandra, senden } = await mitToken();
    const organisation = await json(
      await jonas.anfrage(
        `/api/auth/organization/get-full-organization?organizationId=${jonas.betriebId}`,
      ),
    );
    const mitglied = (organisation.members as { id: string; userId: string }[]).find(
      (m) => m.userId === sandra.nutzerId,
    );
    await jonas.anfrage("/api/auth/organization/remove-member", {
      body: { memberIdOrEmail: mitglied?.id, organizationId: jonas.betriebId },
    });
    const antwort = await senden({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(antwort.status).toBe(403);
  });
});

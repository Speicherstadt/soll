import { describe, expect, it } from "vitest";
import { TEST_URL } from "../test-server.ts";
import { MODERN, mcp, rpc, werkzeug } from "./mcp-testhilfen.ts";
import { tokenVon, weberMitSandra } from "./zugaenge-testhilfen.ts";

/** MCP 2026-07-28 (basic/transports/streamable-http.mdx) and the earlier revisions with initialize */

const mitToken = async () => {
  const w = await weberMitSandra();
  const { token } = await tokenVon(w.sandra);
  return { ...w, token, senden: mcp(w.server, token) };
};

describe("POST /mcp, the transport", () => {
  it("needs a token: 401 with WWW-Authenticate, also with a browser session", async () => {
    const { server, sandra } = await weberMitSandra();
    const ohne = await mcp(server, null)({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(ohne.status).toBe(401);
    expect(ohne.headers.get("www-authenticate")).toBe("Bearer");
    const sitzung = await sandra.anfrage("/mcp", {
      body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    expect(sitzung.status).toBe(401);
    const falsch = await mcp(
      server,
      "soll_falsch",
    )({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(falsch.status).toBe(401);
  });

  it("refuses a foreign Origin with 403 and lets its own through", async () => {
    const { senden } = await mitToken();
    const body = { jsonrpc: "2.0", id: 1, method: "tools/list" };
    const fremd = await senden(body, { kopf: { origin: "http://boese.test" } });
    expect(fremd.status).toBe(403);
    expect((await rpc(fremd)).error?.code).toBe(-32600);
    expect((await senden(body, { kopf: { origin: TEST_URL } })).status).toBe(200);
  });

  it("answers GET and DELETE with 405: no stream of its own, no sessions", async () => {
    const { server, token } = await mitToken();
    for (const method of ["GET", "DELETE"]) {
      const antwort = await server.app.request(`${TEST_URL}/mcp`, {
        method,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(antwort.status, method).toBe(405);
    }
  });

  it("answers a notification with 202 and no body", async () => {
    const { senden } = await mitToken();
    const antwort = await senden(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { fassung: "2025-06-18" },
    );
    expect(antwort.status).toBe(202);
    expect(await antwort.text()).toBe("");
  });

  it("refuses what is no JSON-RPC request with 400", async () => {
    const { server, token, senden } = await mitToken();
    const kaputt = await server.app.request(`${TEST_URL}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{",
    });
    expect(kaputt.status).toBe(400);
    expect((await rpc(kaputt)).error?.code).toBe(-32700);
    const stapel = await senden([{ jsonrpc: "2.0", id: 1, method: "ping" }] as never, {
      fassung: null,
    });
    expect(stapel.status).toBe(400);
    expect((await rpc(stapel)).error?.code).toBe(-32600);
  });
});

describe("POST /mcp, revision 2026-07-28", () => {
  it("answers server/discover with versions, capabilities and its name", async () => {
    const { senden } = await mitToken();
    const antwort = await senden({
      jsonrpc: "2.0",
      id: "d",
      method: "server/discover",
      params: {},
    });
    expect(antwort.status).toBe(200);
    const { id, result } = await rpc(antwort);
    expect(id).toBe("d");
    expect(result).toMatchObject({
      resultType: "complete",
      supportedVersions: [MODERN, "2025-11-25", "2025-06-18", "2025-03-26"],
      capabilities: { tools: {} },
      cacheScope: "public",
      _meta: { "io.modelcontextprotocol/serverInfo": { name: "soll", version: "test" } },
    });
  });

  it("refuses a version it does not speak with 400 and -32022 naming its versions", async () => {
    const { senden } = await mitToken();
    const antwort = await senden(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { fassung: "1900-01-01" },
    );
    expect(antwort.status).toBe(400);
    expect((await rpc(antwort)).error).toEqual({
      code: -32022,
      message: "Unsupported protocol version",
      data: {
        supported: [MODERN, "2025-11-25", "2025-06-18", "2025-03-26"],
        requested: "1900-01-01",
      },
    });
  });

  it("refuses headers that do not match the body with 400 and -32020", async () => {
    const { senden } = await mitToken();
    for (const kopf of [{ "mcp-method": "tools/list" }, { "mcp-name": "stempeln" }]) {
      const antwort = await senden(werkzeug("tag_lesen"), { kopf });
      expect(antwort.status, JSON.stringify(kopf)).toBe(400);
      expect((await rpc(antwort)).error?.code).toBe(-32020);
    }
    const base64 = await senden(werkzeug("tag_lesen"), {
      kopf: { "mcp-name": `=?base64?${Buffer.from("tag_lesen").toString("base64")}?=` },
    });
    expect(base64.status).toBe(200);
  });

  it("answers an unknown method with 404 and -32601, initialize included", async () => {
    const { senden } = await mitToken();
    for (const method of ["resources/list", "initialize"]) {
      const antwort = await senden({ jsonrpc: "2.0", id: 1, method, params: {} });
      expect(antwort.status, method).toBe(404);
      expect((await rpc(antwort)).error?.code).toBe(-32601);
    }
  });

  it("lists its tools sorted, with JSON Schema input and annotations", async () => {
    const { senden } = await mitToken();
    const { result } = await rpc(await senden({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
    const tools = result?.tools as { name: string; inputSchema: object; annotations: object }[];
    const namen = tools.map((t) => t.name);
    expect(namen).toEqual([...namen].sort());
    expect(namen).toEqual([
      "auftraege_lesen",
      "betrieb_lesen",
      "dienstplan_woche",
      "kunden_lesen",
      "monat_lesen",
      "standorte_lesen",
      "stempeln",
      "taetigkeiten_lesen",
      "tag_lesen",
    ]);
    expect(tools.find((t) => t.name === "stempeln")).toMatchObject({
      inputSchema: { type: "object", required: ["art"], additionalProperties: false },
      annotations: { readOnlyHint: false, destructiveHint: false },
    });
    expect(result).toMatchObject({ resultType: "complete", cacheScope: "public" });
  });
});

describe("POST /mcp, earlier revisions", () => {
  it("answers initialize with the client's version, or its newest earlier one", async () => {
    const { senden } = await mitToken();
    const init = (protocolVersion: string) =>
      senden(
        {
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: { protocolVersion, capabilities: {}, clientInfo: { name: "t", version: "1" } },
        },
        { fassung: null },
      );
    const antwort = await init("2025-06-18");
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("mcp-session-id")).toBeNull();
    expect((await rpc(antwort)).result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "soll" },
    });
    expect((await rpc(await init("2024-11-05"))).result?.protocolVersion).toBe("2025-11-25");
  });

  it("answers ping, tools/list without resultType, and an unknown method with 200", async () => {
    const { senden } = await mitToken();
    const alt = { fassung: "2025-11-25" };
    expect(
      (await rpc(await senden({ jsonrpc: "2.0", id: 1, method: "ping" }, alt))).result,
    ).toEqual({});
    const liste = await rpc(await senden({ jsonrpc: "2.0", id: 2, method: "tools/list" }, alt));
    expect(liste.result?.resultType).toBeUndefined();
    expect(liste.result?.tools).toHaveLength(9);
    const unbekannt = await senden({ jsonrpc: "2.0", id: 3, method: "server/discover" }, alt);
    expect(unbekannt.status).toBe(200);
    expect((await rpc(unbekannt)).error?.code).toBe(-32601);
  });
});

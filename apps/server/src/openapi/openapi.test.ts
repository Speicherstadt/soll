import { describe, expect, it } from "vitest";
import { TEST_URL, testServer } from "../test-server.ts";
import { OPERATIONEN, openapiPfad } from "./index.ts";

/**
 * The description covers the API (BAULISTE.md S-607): the routes are read from the app itself, as in
 * module-aus.test.ts, so a route added later fails here until it is described
 */

type Dokument = {
  openapi: string;
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: { securitySchemes: Record<string, unknown> };
  security: unknown[];
};

const routenVon = (server: ReturnType<typeof testServer>): string[] => [
  ...new Set(
    server.app.routes
      .filter((r) => r.method !== "ALL" && r.path.startsWith("/api/v1/"))
      .map((r) => `${r.method} ${r.path}`),
  ),
];

const laden = async () => {
  const server = testServer();
  const antwort = await server.app.request(`${TEST_URL}/api/v1/openapi.json`);
  return { server, antwort, dokument: (await antwort.json()) as Dokument };
};

describe("GET /api/v1/openapi.json", () => {
  it("is public and an OpenAPI 3.1 document with the token and the session as security", async () => {
    const { antwort, dokument } = await laden();
    expect(antwort.status).toBe(200);
    expect(dokument.openapi).toBe("3.1.0");
    expect(Object.keys(dokument.components.securitySchemes).sort()).toEqual(["sitzung", "token"]);
    expect(dokument.security).toEqual([{ token: [] }, { sitzung: [] }]);
  });

  it("describes every route of /api/v1 the app has, and none it lacks", async () => {
    const { server, dokument } = await laden();
    const beschrieben = Object.entries(dokument.paths).flatMap(([pfad, item]) =>
      Object.keys(item).map((methode) => `${methode.toUpperCase()} ${pfad}`),
    );
    const routen = routenVon(server).map((name) => {
      const [methode, pfad] = name.split(" ");
      return `${methode} ${openapiPfad(pfad ?? "")}`;
    });
    expect(beschrieben.sort()).toEqual(routen.sort());
    expect(OPERATIONEN).toHaveLength(routen.length);
  });

  it("gives every operation a unique id, a summary, its path parameters and answers", async () => {
    const { dokument } = await laden();
    const ids = new Set<string>();
    for (const [pfad, item] of Object.entries(dokument.paths))
      for (const [methode, op] of Object.entries(item)) {
        const name = `${methode} ${pfad}`;
        expect(ids.has(op.operationId as string), name).toBe(false);
        ids.add(op.operationId as string);
        expect((op.summary as string).length, name).toBeGreaterThan(5);
        const imPfad = [...pfad.matchAll(/\{(\w+)\}/g)].map((t) => t[1]);
        const parameter = (op.parameters as { name: string; in: string }[])
          .filter((p) => p.in === "path")
          .map((p) => p.name);
        expect(parameter, name).toEqual(imPfad);
        expect(Object.keys(op.responses as object), name).toContain("2XX");
      }
  });

  it("takes the input from the routes' Zod schemas", async () => {
    const { dokument } = await laden();
    const stempeln = dokument.paths["/api/v1/arbeitszeit/stempelungen"]?.post as {
      requestBody: { content: { "application/json": { schema: Record<string, unknown> } } };
    };
    const schema = stempeln.requestBody.content["application/json"].schema;
    expect(schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["art"],
      properties: { art: { enum: ["kommen", "gehen", "pause_beginn", "pause_ende"] } },
    });
    const tag = dokument.paths["/api/v1/arbeitszeit/tag"]?.get as {
      parameters: { name: string; in: string; required: boolean }[];
    };
    expect(tag.parameters.map(({ name, in: wo, required }) => ({ name, wo, required }))).toEqual([
      { name: "datum", wo: "query", required: false },
      { name: "nutzerId", wo: "query", required: false },
    ]);
    const oeffentlich = dokument.paths["/api/v1/pruefen"]?.post as { security: unknown[] };
    expect(oeffentlich.security).toEqual([]);
  });
});

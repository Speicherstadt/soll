import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

const einladen = async (zeilen: string[] = []) => {
  const server = testServer({ log: (zeile) => zeilen.push(zeile) });
  const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  const einladung = await json(
    await weber.anfrage("/api/v1/einladungen", { body: { rolle: "mitarbeiter", name: "Anna" } }),
  );
  const token = String(einladung.link).split("/einladung/")[1] ?? "";
  return { server, token };
};

describe("the token of an invitation, on a detour", () => {
  it("stays out of the log when the path is percent-encoded (Hono decodes it for routing)", async () => {
    const zeilen: string[] = [];
    const { server, token } = await einladen(zeilen);
    const antwort = await server.browser().anfrage(`/api/v1/%65inladung/${token}`);
    expect(antwort.status).toBe(200);
    expect(zeilen.filter((zeile) => zeile.includes(token))).toEqual([]);
  });
});

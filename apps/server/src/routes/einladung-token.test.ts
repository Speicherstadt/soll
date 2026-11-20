import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

describe("the token of an invitation", () => {
  it("does not reach the request log", async () => {
    const zeilen: string[] = [];
    const server = testServer({ log: (zeile) => zeilen.push(zeile) });
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const einladung = await json(
      await weber.anfrage("/api/v1/einladungen", { body: { rolle: "mitarbeiter", name: "Anna" } }),
    );
    const token = String(einladung.link).split("/einladung/")[1] ?? "";
    expect(token.length).toBeGreaterThan(20);
    const gast = server.browser();
    await gast.anfrage(`/api/v1/einladung/${token}`);
    await gast.anfrage(`/api/v1/einladung/${token}/annehmen`, {
      body: { benutzername: "anna", passwort: "lange-genug-123" },
    });
    expect(zeilen.some((zeile) => zeile.includes("/api/v1/einladung/"))).toBe(true);
    expect(zeilen.filter((zeile) => zeile.includes(token))).toEqual([]);
  });
});

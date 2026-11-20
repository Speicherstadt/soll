import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

// Better Auth refuses passwords longer than 128 characters (its default maxPasswordLength), so a
// longer one is a bad request, not a conflict, and the invitation stays open.
describe("accepting an invitation with a password", () => {
  it("refuses one longer than 128 characters with 400 and keeps the invitation", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const einladung = await json(
      await weber.anfrage("/api/v1/einladungen", { body: { rolle: "mitarbeiter", name: "Anna" } }),
    );
    const token = String(einladung.link).split("/einladung/")[1] ?? "";
    const gast = server.browser();
    const zuLang = await gast.anfrage(`/api/v1/einladung/${token}/annehmen`, {
      body: { benutzername: "anna", passwort: "x".repeat(129) },
    });
    expect(zuLang.status).toBe(400);
    const passend = await gast.anfrage(`/api/v1/einladung/${token}/annehmen`, {
      body: { benutzername: "anna", passwort: "x".repeat(128) },
    });
    expect(passend.status).toBe(201);
  });
});

import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";

type Server = ReturnType<typeof testServer>;
type Person = Awaited<ReturnType<Server["inhaberMitBetrieb"]>>;

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

const PASSWORT = "lange-genug-123";

const einladen = async (server: Server, inhaber: Person, rolle: string, benutzername: string) => {
  const einladung = await json(
    await inhaber.anfrage("/api/v1/einladungen", { body: { rolle, name: benutzername } }),
  );
  const token = String(einladung.link).split("/einladung/")[1] ?? "";
  await server.browser().anfrage(`/api/v1/einladung/${token}/annehmen`, {
    body: { benutzername, passwort: PASSWORT },
  });
};

// A device may only check PINs at the terminal (docs/anmeldung.md, "Rollen"; rollen.ts gives it no
// `betrieb:lesen`), yet Better Auth's own read routes need nothing but membership and handed the
// tablet at the entrance every member's name and e-mail address.
describe("a device", () => {
  it("does not read the members of its business through Better Auth", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await einladen(server, weber, "mitarbeiter", "anna");
    await einladen(server, weber, "geraet", "terminal");
    const terminal = server.browser();
    await terminal.anfrage("/api/auth/sign-in/username", {
      body: { username: "terminal", password: PASSWORT },
    });
    await terminal.anfrage("/api/auth/organization/set-active", {
      body: { organizationId: weber.betriebId },
    });
    for (const pfad of [
      "/api/auth/organization/get-full-organization",
      `/api/auth/organization/get-full-organization?organizationId=${weber.betriebId}`,
      "/api/auth/organization/get-full-organization?organizationSlug=weber",
      "/api/auth/organization/list-members",
      "/api/auth/organization/list-members?organizationSlug=weber",
      `/api/auth/organization/get-active-member-role?userId=${weber.nutzerId}`,
    ]) {
      const antwort = await terminal.anfrage(pfad);
      expect(antwort.status, pfad).toBe(403);
      expect(await antwort.text(), pfad).not.toContain("weber@betrieb.test");
    }
    // the owner still reads them
    const inhaber = await weber.anfrage("/api/auth/organization/list-members");
    expect(inhaber.status).toBe(200);
  });
});

import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";

type Server = ReturnType<typeof testServer>;
type Person = Awaited<ReturnType<Server["inhaberMitBetrieb"]>>;

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

const PASSWORT = "lange-genug-123";

/** A browser signed in as `benutzername` with the owner's business active */
const anmelden = async (server: Server, inhaber: Person, benutzername: string) => {
  const b = server.browser();
  await b.anfrage("/api/auth/sign-in/username", {
    body: { username: benutzername, password: PASSWORT },
  });
  await b.anfrage("/api/auth/organization/set-active", {
    body: { organizationId: inhaber.betriebId },
  });
  return b;
};

/** Invites someone into the owner's business and lets them accept */
const einladen = async (server: Server, inhaber: Person, rolle: string, benutzername: string) => {
  const einladung = await json(
    await inhaber.anfrage("/api/v1/einladungen", { body: { rolle, name: benutzername } }),
  );
  const token = String(einladung.link).split("/einladung/")[1] ?? "";
  const angenommen = await server.browser().anfrage(`/api/v1/einladung/${token}/annehmen`, {
    body: { benutzername, passwort: PASSWORT },
  });
  return String((await json(angenommen)).nutzerId);
};

const mitgliedId = async (inhaber: Person, nutzerId: string) => {
  const organisation = await json(
    await inhaber.anfrage(
      `/api/auth/organization/get-full-organization?organizationId=${inhaber.betriebId}`,
    ),
  );
  return (organisation.members as { id: string; userId: string }[]).find(
    (m) => m.userId === nutzerId,
  )?.id;
};

describe("the mirror of the memberships", () => {
  it("drops a member who leaves through Better Auth, also for their other sessions", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await einladen(server, weber, "mitarbeiter", "anna");
    const telefon = await anmelden(server, weber, "anna");
    const rechner = await anmelden(server, weber, "anna");
    expect((await rechner.anfrage("/api/v1/betrieb")).status).toBe(200);
    const austritt = await telefon.anfrage("/api/auth/organization/leave", {
      body: { organizationId: weber.betriebId },
    });
    expect(austritt.status).toBe(200);
    expect((await rechner.anfrage("/api/v1/betrieb")).status).toBe(403);
    // and she no longer counts as an employee
    expect(
      (
        await weber.anfrage("/api/v1/betrieb/module", {
          method: "PATCH",
          body: { arbeitszeit: false },
        })
      ).status,
    ).toBe(200);
  });
});

describe("the duty to record working time", () => {
  it("cannot be dodged by switching it off before an employee joins", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await weber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { arbeitszeit: false },
    });
    await einladen(server, weber, "mitarbeiter", "sandra");
    expect((await json(await weber.anfrage("/api/v1/betrieb"))).module).toMatchObject({
      arbeitszeit: true,
    });
  });

  it("cannot be dodged by a change of role", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const max = await einladen(server, weber, "extern", "max");
    await weber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { arbeitszeit: false },
    });
    const wechsel = await weber.anfrage("/api/auth/organization/update-member-role", {
      body: {
        memberId: await mitgliedId(weber, max),
        role: "mitarbeiter",
        organizationId: weber.betriebId,
      },
    });
    expect(wechsel.status).toBe(200);
    expect((await json(await weber.anfrage("/api/v1/betrieb"))).module).toMatchObject({
      arbeitszeit: true,
    });
  });

  it("counts a member with several roles, one of them employed", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const max = await einladen(server, weber, "extern", "max");
    await weber.anfrage("/api/auth/organization/update-member-role", {
      body: {
        memberId: await mitgliedId(weber, max),
        role: ["extern", "mitarbeiter"],
        organizationId: weber.betriebId,
      },
    });
    const aus = await weber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { arbeitszeit: false },
    });
    expect(aus.status).toBe(409);
  });
});

import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";

type Server = ReturnType<typeof testServer>;
type Person = Awaited<ReturnType<Server["inhaberMitBetrieb"]>>;

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

/** Invites someone into the owner's business and lets them accept and sign in with a username */
const eingeladen = async (server: Server, inhaber: Person, rolle: string, benutzername: string) => {
  const einladung = await json(
    await inhaber.anfrage("/api/v1/einladungen", { body: { rolle, name: benutzername } }),
  );
  const token = String(einladung.link).split("/einladung/")[1] ?? "";
  const b = server.browser();
  const angenommen = await b.anfrage(`/api/v1/einladung/${token}/annehmen`, {
    body: { benutzername, passwort: "lange-genug-123" },
  });
  expect(angenommen.status).toBe(201);
  const { nutzerId } = await json(angenommen);
  expect(
    (
      await b.anfrage("/api/auth/sign-in/username", {
        body: { username: benutzername, password: "lange-genug-123" },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await b.anfrage("/api/auth/organization/set-active", {
        body: { organizationId: inhaber.betriebId },
      })
    ).status,
  ).toBe(200);
  return { ...b, nutzerId: String(nutzerId), token };
};

describe("a business", () => {
  it("is created with its organization, the creator as owner, and stands in the chain", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const betrieb = await json(await weber.anfrage("/api/v1/betrieb"));
    expect(betrieb).toMatchObject({
      name: "Weber Haustechnik",
      module: { arbeitszeit: true, dienstplan: false, projektzeit: false, terminal: false },
    });
    const rollen = server.sqlite
      .query("SELECT rolle FROM mitgliedschaften WHERE betrieb_id = ?")
      .all(weber.betriebId);
    expect(rollen).toEqual([{ rolle: "inhaber" }]);
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);
  });
});

describe("no business sees another's data", () => {
  const zwei = async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const elbblick = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    return { server, weber, elbblick };
  };

  it("GET /api/v1/betrieb shows only one's own business", async () => {
    const { weber, elbblick } = await zwei();
    expect((await json(await weber.anfrage("/api/v1/betrieb"))).name).toBe("Weber Haustechnik");
    expect((await json(await elbblick.anfrage("/api/v1/betrieb"))).name).toBe("Café Elbblick");
  });

  it("a session cannot switch to a business it is no member of", async () => {
    const { weber, elbblick } = await zwei();
    const wechsel = await weber.anfrage("/api/auth/organization/set-active", {
      body: { organizationId: elbblick.betriebId },
    });
    expect(wechsel.status).toBe(403);
    // Better Auth then clears the active business: no data of either, until one's own is chosen again
    const danach = await weber.anfrage("/api/v1/betrieb");
    expect(danach.status).toBe(403);
    expect(await json(danach)).toEqual({ fehler: "kein_betrieb" });
  });

  it("PATCH /api/v1/betrieb/module changes only one's own business", async () => {
    const { weber, elbblick } = await zwei();
    expect(
      (
        await weber.anfrage("/api/v1/betrieb/module", {
          method: "PATCH",
          body: { dienstplan: true },
        })
      ).status,
    ).toBe(200);
    expect((await json(await elbblick.anfrage("/api/v1/betrieb"))).module).toMatchObject({
      dienstplan: false,
    });
  });

  it("POST /api/v1/einladungen invites into one's own business only", async () => {
    const { server, weber } = await zwei();
    const anna = await eingeladen(server, weber, "mitarbeiter", "anna");
    const zeilen = server.sqlite
      .query("SELECT betrieb_id FROM mitgliedschaften WHERE nutzer_id = ?")
      .all(anna.nutzerId);
    expect(zeilen).toEqual([{ betrieb_id: weber.betriebId }]);
  });

  it("PUT /api/v1/pins/:nutzerId refuses a person of another business", async () => {
    const { weber, elbblick } = await zwei();
    expect(
      (
        await weber.anfrage(`/api/v1/pins/${elbblick.nutzerId}`, {
          method: "PUT",
          body: { pin: "1234" },
        })
      ).status,
    ).toBe(404);
  });

  it("POST /api/v1/terminal/pins/:nutzerId/pruefen does not reach a person of another business", async () => {
    const { server, weber, elbblick } = await zwei();
    for (const p of [weber, elbblick])
      await p.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
    await elbblick.anfrage(`/api/v1/pins/${elbblick.nutzerId}`, {
      method: "PUT",
      body: { pin: "1234" },
    });
    const terminal = await eingeladen(server, weber, "geraet", "terminal_weber");
    const versuch = await terminal.anfrage(`/api/v1/terminal/pins/${elbblick.nutzerId}/pruefen`, {
      body: { pin: "1234" },
    });
    expect(versuch.status).toBe(404);
  });

  it("GET /api/v1/<modul>/status follows one's own business", async () => {
    const { weber, elbblick } = await zwei();
    await elbblick.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { dienstplan: true },
    });
    expect((await weber.anfrage("/api/v1/dienstplan/status")).status).toBe(403);
    expect((await elbblick.anfrage("/api/v1/dienstplan/status")).status).toBe(200);
  });

  it("refuses every route of /api/v1 without a session", async () => {
    const { server } = await zwei();
    const fremd = server.browser();
    for (const [pfad, method] of [
      ["/api/v1/betrieb", "GET"],
      ["/api/v1/betrieb/module", "PATCH"],
      ["/api/v1/einladungen", "POST"],
      ["/api/v1/pins/x", "PUT"],
      ["/api/v1/terminal/pins/x/pruefen", "POST"],
      ["/api/v1/arbeitszeit/status", "GET"],
    ] as const) {
      expect(
        (await fremd.anfrage(pfad, { method, ...(method === "GET" ? {} : { body: {} }) })).status,
        pfad,
      ).toBe(401);
    }
  });
});

describe("an invitation without an e-mail address", () => {
  it("leads to an account that signs in with its username, in the role of the invitation", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const einladung = await json(
      await weber.anfrage("/api/v1/einladungen", {
        body: { rolle: "mitarbeiter", name: "Sandra" },
      }),
    );
    const token = String(einladung.link).split("/einladung/")[1] ?? "";
    const gast = server.browser();
    expect(await json(await gast.anfrage(`/api/v1/einladung/${token}`))).toEqual({
      betrieb: "Weber Haustechnik",
      name: "Sandra",
      rolle: "mitarbeiter",
    });
    const sandra = await (async () => {
      const angenommen = await gast.anfrage(`/api/v1/einladung/${token}/annehmen`, {
        body: { benutzername: "sandra", passwort: "lange-genug-123" },
      });
      expect(angenommen.status).toBe(201);
      return gast;
    })();
    expect(
      (
        await sandra.anfrage("/api/auth/sign-in/username", {
          body: { username: "sandra", password: "lange-genug-123" },
        })
      ).status,
    ).toBe(200);
    await sandra.anfrage("/api/auth/organization/set-active", {
      body: { organizationId: weber.betriebId },
    });
    expect((await json(await sandra.anfrage("/api/v1/betrieb"))).name).toBe("Weber Haustechnik");
    // a member, not an owner
    expect(
      (
        await sandra.anfrage("/api/v1/betrieb/module", {
          method: "PATCH",
          body: { dienstplan: true },
        })
      ).status,
    ).toBe(403);
  });

  it("works once and not after it expired", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const anna = await eingeladen(server, weber, "mitarbeiter", "anna");
    const wieder = await server.browser().anfrage(`/api/v1/einladung/${anna.token}/annehmen`, {
      body: { benutzername: "anna2", passwort: "lange-genug-123" },
    });
    expect(await json(wieder)).toEqual({ fehler: "angenommen" });
    const spaet = await json(
      await weber.anfrage("/api/v1/einladungen", { body: { rolle: "mitarbeiter", name: "Max" } }),
    );
    server.stelleUhr(1_790_000_000_000 + 8 * 24 * 60 * 60 * 1000);
    const token = String(spaet.link).split("/einladung/")[1] ?? "";
    expect(await json(await server.browser().anfrage(`/api/v1/einladung/${token}`))).toEqual({
      fehler: "abgelaufen",
    });
  });

  it("lets a planner invite employees but not owners", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const anna = await eingeladen(server, weber, "planer", "anna");
    expect(
      (await anna.anfrage("/api/v1/einladungen", { body: { rolle: "mitarbeiter", name: "Max" } }))
        .status,
    ).toBe(201);
    expect(
      (await anna.anfrage("/api/v1/einladungen", { body: { rolle: "inhaber", name: "Max" } }))
        .status,
    ).toBe(403);
  });
});

describe("a change of role", () => {
  it("stands in the audit chain", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const anna = await eingeladen(server, weber, "mitarbeiter", "anna");
    const organisation = await json(
      await weber.anfrage(
        `/api/auth/organization/get-full-organization?organizationId=${weber.betriebId}`,
      ),
    );
    const mitglied = (organisation.members as { id: string; userId: string }[]).find(
      (m) => m.userId === anna.nutzerId,
    );
    const wechsel = await weber.anfrage("/api/auth/organization/update-member-role", {
      body: { memberId: mitglied?.id, role: "planer", organizationId: weber.betriebId },
    });
    expect(wechsel.status).toBe(200);
    const glieder = server.sqlite
      .query(
        "SELECT g.aktion, i.inhalt FROM audit_glieder g JOIN audit_inhalte i USING (betrieb_id, seq) WHERE g.betrieb_id = ? AND g.tabelle = 'mitgliedschaften' ORDER BY g.seq",
      )
      .all(weber.betriebId) as { aktion: string; inhalt: string }[];
    expect(glieder.at(-1)?.aktion).toBe("aendern");
    expect(JSON.parse(glieder.at(-1)?.inhalt ?? "{}")).toMatchObject({
      nutzerId: anna.nutzerId,
      rolle: "planer",
    });
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);
  });
});

describe("the PIN", () => {
  it("is locked after five wrong tries and unlocked by a new one", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
    const max = await eingeladen(server, weber, "mitarbeiter", "max");
    const terminal = await eingeladen(server, weber, "geraet", "terminal");
    expect(
      (
        await weber.anfrage(`/api/v1/pins/${max.nutzerId}`, {
          method: "PUT",
          body: { pin: "4711" },
        })
      ).status,
    ).toBe(204);
    const pruefen = (pin: string) =>
      terminal.anfrage(`/api/v1/terminal/pins/${max.nutzerId}/pruefen`, { body: { pin } });
    expect((await pruefen("4711")).status).toBe(200);
    for (let versuch = 1; versuch <= 4; versuch++)
      expect((await pruefen("0000")).status, `try ${versuch}`).toBe(401);
    expect(await json(await pruefen("0000"))).toEqual({ ergebnis: "gesperrt" });
    expect((await pruefen("4711")).status).toBe(423);
    await weber.anfrage(`/api/v1/pins/${max.nutzerId}`, { method: "PUT", body: { pin: "2468" } });
    expect((await pruefen("2468")).status).toBe(200);
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);
  });

  it("counts a right PIN in between as a fresh start", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
    const max = await eingeladen(server, weber, "mitarbeiter", "max");
    const terminal = await eingeladen(server, weber, "geraet", "terminal");
    await weber.anfrage(`/api/v1/pins/${max.nutzerId}`, { method: "PUT", body: { pin: "4711" } });
    const pruefen = (pin: string) =>
      terminal.anfrage(`/api/v1/terminal/pins/${max.nutzerId}/pruefen`, { body: { pin } });
    for (let versuch = 1; versuch <= 4; versuch++) await pruefen("0000");
    expect((await pruefen("4711")).status).toBe(200);
    expect((await pruefen("0000")).status).toBe(401);
  });
});

describe("modules", () => {
  for (const name of ["arbeitszeit", "dienstplan", "projektzeit", "terminal"] as const) {
    it(`refuses the routes of ${name} while it is switched off`, async () => {
      const server = testServer();
      const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
      await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { [name]: true } });
      expect((await weber.anfrage(`/api/v1/${name}/status`)).status).toBe(200);
      await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { [name]: false } });
      const abgelehnt = await weber.anfrage(`/api/v1/${name}/status`);
      expect(abgelehnt.status).toBe(403);
      expect(await json(abgelehnt)).toEqual({ fehler: "modul_aus", modul: name });
    });
  }

  it("keeps working time on while the business has employees", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    expect(
      (
        await weber.anfrage("/api/v1/betrieb/module", {
          method: "PATCH",
          body: { arbeitszeit: false },
        })
      ).status,
    ).toBe(200);
    await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { arbeitszeit: true } });
    await eingeladen(server, weber, "mitarbeiter", "sandra");
    const abgelehnt = await weber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { arbeitszeit: false },
    });
    expect(abgelehnt.status).toBe(409);
    expect(await json(abgelehnt)).toEqual({ fehler: "arbeitszeit_pflicht" });
  });

  it("deletes no data when switched off", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
    const max = await eingeladen(server, weber, "mitarbeiter", "max");
    const terminal = await eingeladen(server, weber, "geraet", "terminal");
    await weber.anfrage(`/api/v1/pins/${max.nutzerId}`, { method: "PUT", body: { pin: "4711" } });
    await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: false } });
    expect(
      (
        await terminal.anfrage(`/api/v1/terminal/pins/${max.nutzerId}/pruefen`, {
          body: { pin: "4711" },
        })
      ).status,
    ).toBe(403);
    await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
    expect(
      (
        await terminal.anfrage(`/api/v1/terminal/pins/${max.nutzerId}/pruefen`, {
          body: { pin: "4711" },
        })
      ).status,
    ).toBe(200);
  });
});

describe("passkeys", () => {
  it("are offered to a signed-in account for this instance", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const optionen = await weber.anfrage("/api/auth/passkey/generate-register-options");
    expect(optionen.status).toBe(200);
    const daten = await json(optionen);
    expect(daten).toMatchObject({ rp: { id: "localhost", name: "Soll" } });
    expect(typeof daten.challenge).toBe("string");
    expect(
      (await server.browser().anfrage("/api/auth/passkey/generate-register-options")).status,
    ).toBe(401);
  });
});

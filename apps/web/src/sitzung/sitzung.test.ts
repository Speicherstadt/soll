import { afterEach, describe, expect, it, vi } from "vitest";
import { abmeldenAusfuehren, sitzung } from "./sitzung.ts";

describe("abmeldenAusfuehren", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("clears the local session and returns empty string on successful sign-out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    expect(await abmeldenAusfuehren()).toBe("");
    expect(sitzung()).toEqual({ art: "abgemeldet" });
  });

  it("returns netz when the sign-out request fails at the network layer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await abmeldenAusfuehren()).toBe("netz");
  });

  it("succeeds if sign-out returned an error because the session was already gone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/auth/sign-out")) {
          return new Response(JSON.stringify({ fehler: "already_signed_out" }), { status: 400 });
        }
        return new Response(JSON.stringify({ fehler: "nicht_angemeldet" }), { status: 401 });
      }),
    );
    expect(await abmeldenAusfuehren()).toBe("");
    expect(sitzung()).toEqual({ art: "abgemeldet" });
  });

  it("returns fehler when sign-out fails and the session is still active", async () => {
    const betrieb = {
      betriebId: "b1",
      name: "Weber Haustechnik",
      nutzerId: "u1",
      nutzerName: "Jonas Weber",
      rolle: "inhaber",
      module: {
        arbeitszeit: true,
        abwesenheiten: true,
        dienstplan: true,
        projektzeit: true,
        terminal: false,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/auth/sign-out")) {
          return new Response(JSON.stringify({ fehler: "server" }), { status: 500 });
        }
        return new Response(JSON.stringify(betrieb), { status: 200 });
      }),
    );
    expect(await abmeldenAusfuehren()).toBe("fehler");
  });
});

import { describe, expect, it, vi } from "vitest";
import { abmeldenAblauf } from "./abmelden.ts";
import type { Betrieb } from "./ziel.ts";

const BETRIEB: Betrieb = {
  betriebId: "b1",
  name: "Weber Haustechnik",
  land: "HH",
  eingerichtet: true,
  nutzerId: "u1",
  nutzerName: "Jonas Weber",
  rolle: "inhaber",
  hinweis: null,
  auswertungJePersonSeit: null,
  module: {
    arbeitszeit: true,
    dienstplan: true,
    projektzeit: true,
    terminal: false,
  },
};

describe("abmeldenAblauf", () => {
  it("clears the local session and returns empty string on successful sign-out", async () => {
    const loeschen = vi.fn();
    const pruefen = vi.fn(async () => ({ art: "abgemeldet" as const }));
    const ergebnis = await abmeldenAblauf({
      senden: async () => ({ ok: true, status: 200, daten: { ok: true } }),
      loeschen,
      pruefen,
    });
    expect(ergebnis).toBe("");
    expect(loeschen).toHaveBeenCalledTimes(1);
    expect(pruefen).not.toHaveBeenCalled();
  });

  it("returns netz without clearing local state when sign-out gets no network response", async () => {
    const loeschen = vi.fn();
    const pruefen = vi.fn(async () => ({ art: "abgemeldet" as const }));
    const ergebnis = await abmeldenAblauf({
      senden: async () => ({ ok: false, status: 0, fehler: "netz" }),
      loeschen,
      pruefen,
    });
    expect(ergebnis).toBe("netz");
    expect(loeschen).not.toHaveBeenCalled();
    expect(pruefen).not.toHaveBeenCalled();
  });

  it("succeeds if sign-out returned an error because the session was already gone", async () => {
    const loeschen = vi.fn();
    const pruefen = vi.fn(async () => ({ art: "abgemeldet" as const }));
    const ergebnis = await abmeldenAblauf({
      senden: async () => ({ ok: false, status: 400, fehler: "already_signed_out" }),
      loeschen,
      pruefen,
    });
    expect(ergebnis).toBe("");
    expect(loeschen).not.toHaveBeenCalled();
    expect(pruefen).toHaveBeenCalledTimes(1);
  });

  it("returns fehler when sign-out fails and the session is still active", async () => {
    const loeschen = vi.fn();
    const pruefen = vi.fn(async () => ({ art: "bereit" as const, betrieb: BETRIEB }));
    const ergebnis = await abmeldenAblauf({
      senden: async () => ({ ok: false, status: 500, fehler: "server" }),
      loeschen,
      pruefen,
    });
    expect(ergebnis).toBe("fehler");
    expect(loeschen).not.toHaveBeenCalled();
    expect(pruefen).toHaveBeenCalledTimes(1);
  });

  it("returns fehler when sign-out fails and session re-check is offline", async () => {
    const loeschen = vi.fn();
    const pruefen = vi.fn(async () => ({ art: "offline" as const, betrieb: BETRIEB }));
    const ergebnis = await abmeldenAblauf({
      senden: async () => ({ ok: false, status: 500, fehler: "server" }),
      loeschen,
      pruefen,
    });
    expect(ergebnis).toBe("fehler");
    expect(loeschen).not.toHaveBeenCalled();
    expect(pruefen).toHaveBeenCalledTimes(1);
  });
});

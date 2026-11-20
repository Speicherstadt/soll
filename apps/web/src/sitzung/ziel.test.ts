import { describe, expect, it } from "vitest";
import { ALLE_MODULE } from "../rahmen/module.ts";
import { type Betrieb, zielFuer } from "./ziel.ts";

const betrieb = (anders: Partial<Betrieb> = {}): Betrieb => ({
  betriebId: "b1",
  name: "Café Elbblick",
  land: "HH",
  eingerichtet: true,
  rolle: "inhaber",
  module: { arbeitszeit: true, dienstplan: true, projektzeit: false, terminal: false },
  ...anders,
});

describe("where the app leads", () => {
  it("a visitor without a session to the sign-in, except to sign-up and an invitation", () => {
    const z = { art: "abgemeldet" } as const;
    expect(zielFuer(z, "/")).toBe("/anmelden");
    expect(zielFuer(z, "/einrichtung")).toBe("/anmelden");
    expect(zielFuer(z, "/anmelden")).toBeNull();
    expect(zielFuer(z, "/registrieren")).toBeNull();
    expect(zielFuer(z, "/einladung/abc")).toBeNull();
  });

  it("an account without a business to the setup", () => {
    const z = { art: "ohne_betrieb" } as const;
    expect(zielFuer(z, "/")).toBe("/einrichtung");
    expect(zielFuer(z, "/anmelden")).toBe("/einrichtung");
    expect(zielFuer(z, "/einrichtung")).toBeNull();
    expect(zielFuer(z, "/einladung/abc")).toBeNull();
  });

  it("the owner to the setup until it is finished, then away from it", () => {
    const offen = { art: "bereit", betrieb: betrieb({ eingerichtet: false }) } as const;
    expect(zielFuer(offen, "/")).toBe("/einrichtung");
    expect(zielFuer(offen, "/einstellungen")).toBe("/einrichtung");
    expect(zielFuer(offen, "/einrichtung")).toBeNull();
    const fertig = { art: "bereit", betrieb: betrieb() } as const;
    expect(zielFuer(fertig, "/einrichtung")).toBe("/");
    expect(zielFuer(fertig, "/anmelden")).toBe("/");
    expect(zielFuer(fertig, "/dienstplan")).toBeNull();
  });

  it("a member who is not the owner never to the setup", () => {
    const z = {
      art: "bereit",
      betrieb: betrieb({ eingerichtet: false, rolle: "mitarbeiter" }),
    } as const;
    expect(zielFuer(z, "/")).toBeNull();
    expect(zielFuer(z, "/einrichtung")).toBe("/");
  });

  it("an area of a switched-off module to Heute", () => {
    const z = { art: "bereit", betrieb: betrieb() } as const;
    expect(zielFuer(z, "/projekte")).toBe("/");
    expect(zielFuer(z, "/zeiten")).toBeNull();
    // the router keeps a trailing slash; a page below an area belongs to it
    expect(zielFuer(z, "/projekte/")).toBe("/");
    expect(zielFuer(z, "/projekte/42")).toBe("/");
  });

  it("nowhere while the server cannot be reached: the app opens offline", () => {
    expect(zielFuer({ art: "offline", betrieb: null }, "/")).toBeNull();
    expect(
      zielFuer({ art: "offline", betrieb: betrieb({ module: ALLE_MODULE }) }, "/zeiten"),
    ).toBeNull();
  });

  it("everyone to the check page, signed in or not (S-306)", () => {
    expect(zielFuer({ art: "abgemeldet" }, "/pruefen")).toBeNull();
    expect(zielFuer({ art: "ohne_betrieb" }, "/pruefen")).toBeNull();
    expect(zielFuer({ art: "bereit", betrieb: betrieb() }, "/pruefen")).toBeNull();
    expect(
      zielFuer({ art: "bereit", betrieb: betrieb({ eingerichtet: false }) }, "/pruefen"),
    ).toBeNull();
  });
});

import type { Module } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import { hinweiseFuer, schritteFuer } from "./schritte.ts";

const FREELANCER: Module = {
  arbeitszeit: false,
  dienstplan: false,
  projektzeit: true,
  terminal: false,
};
const CAFE: Module = { arbeitszeit: true, dienstplan: true, projektzeit: false, terminal: false };
const SHK: Module = { arbeitszeit: true, dienstplan: false, projektzeit: true, terminal: true };

describe("the steps of the setup follow the modules", () => {
  it("a freelancer names the business and is done", () => {
    expect(schritteFuer(FREELANCER)).toEqual(["betrieb"]);
  });

  it("a business with employees sets up sites, working time, people and invitations", () => {
    expect(schritteFuer(CAFE)).toEqual([
      "betrieb",
      "standorte",
      "arbeitszeit",
      "mitarbeiter",
      "einladungen",
    ]);
    expect(schritteFuer(SHK)).toEqual(schritteFuer(CAFE));
  });
});

describe("the hints follow the modules", () => {
  it("names the terminal where a site and a PIN matter", () => {
    expect(hinweiseFuer("standorte", SHK)).toEqual(["feiertage", "terminal_standort"]);
    expect(hinweiseFuer("standorte", CAFE)).toEqual(["feiertage"]);
    expect(hinweiseFuer("einladungen", SHK)).toContain("terminal_pin");
    expect(hinweiseFuer("einladungen", CAFE)).not.toContain("terminal_pin");
  });

  it("says that the rota sets the hours of shift workers", () => {
    expect(hinweiseFuer("arbeitszeit", CAFE)).toEqual(["vorlagen", "dienstplan_soll"]);
    expect(hinweiseFuer("arbeitszeit", SHK)).toEqual(["vorlagen"]);
  });

  it("shows on the last step what comes next in each module", () => {
    expect(hinweiseFuer("betrieb", FREELANCER)).toEqual(["solo", "danach_projekte"]);
    expect(hinweiseFuer("einladungen", CAFE)).toEqual([
      "links_einmal",
      "danach_stempeln",
      "danach_dienstplan",
    ]);
    expect(hinweiseFuer("einladungen", SHK)).toEqual([
      "links_einmal",
      "terminal_pin",
      "danach_stempeln",
      "danach_projekte",
      "danach_terminal",
    ]);
  });

  it("tells a business with employees that working time is required", () => {
    expect(hinweiseFuer("betrieb", CAFE)).toEqual(["pflicht"]);
  });
});

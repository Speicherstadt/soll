import { describe, expect, it } from "vitest";
import { adresseNormalisieren, apiBasis } from "./adresse.ts";

describe("the address of a Haben (docs/api.md: https://<deine Adresse>/api/v1)", () => {
  it("keeps the address without a trailing slash or /api/v1", () => {
    expect(adresseNormalisieren("https://haben.example.de")).toBe("https://haben.example.de");
    expect(adresseNormalisieren(" https://haben.example.de/ ")).toBe("https://haben.example.de");
    expect(adresseNormalisieren("https://haben.example.de/api/v1/")).toBe(
      "https://haben.example.de",
    );
    expect(adresseNormalisieren("http://haben:3000/buero")).toBe("http://haben:3000/buero");
  });

  it("refuses what is no web address or carries a secret or a query", () => {
    for (const falsch of [
      "",
      "haben.example.de",
      "ftp://haben.example.de",
      "javascript:alert(1)",
      "https://jonas:geheim@haben.example.de",
      "https://haben.example.de/?token=hb_1",
      "https://haben.example.de/#x",
    ])
      expect(adresseNormalisieren(falsch), falsch).toBeNull();
  });

  it("puts the version of the API after the address", () => {
    expect(apiBasis("https://haben.example.de")).toBe("https://haben.example.de/api/v1");
  });
});

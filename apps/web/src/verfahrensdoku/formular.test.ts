import { describe, expect, it } from "vitest";
import { angabenAus, eigenerName } from "./formular.ts";

const form = (werte: Record<string, string>) => {
  const daten = new FormData();
  for (const [name, wert] of Object.entries(werte)) daten.set(name, wert);
  return daten;
};

describe("angabenAus", () => {
  it("takes every field, empty when missing", () => {
    const angaben = angabenAus(form({ rechtsform: "GmbH", anschrift: "Elbstraße 5" }), []);
    expect(angaben).toEqual({
      rechtsform: "GmbH",
      anschrift: "Elbstraße 5",
      verantwortlich: "",
      aufbewahrungsort: "",
      serverbetrieb: "",
      datensicherung: "",
      schluesselablage: "",
      eigene: [],
    });
  });

  it("takes the own sections in the order of the rows and drops empty ones", () => {
    const angaben = angabenAus(
      form({
        [eigenerName("titel", 7)]: "Zweiter",
        [eigenerName("text", 7)]: "b",
        [eigenerName("titel", 2)]: "Erster",
        [eigenerName("text", 2)]: "a",
        [eigenerName("titel", 4)]: " ",
        [eigenerName("text", 4)]: "",
      }),
      [2, 4, 7],
    );
    expect(angaben.eigene).toEqual([
      { titel: "Erster", text: "a" },
      { titel: "Zweiter", text: "b" },
    ]);
  });
});

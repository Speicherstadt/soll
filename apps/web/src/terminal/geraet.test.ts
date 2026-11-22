import { describe, expect, it } from "vitest";
import { kopplungLesen, kopplungMerken, kopplungVergessen } from "./geraet.ts";

const speicher = () => {
  const werte = new Map<string, string>();
  return {
    getItem: (k: string) => werte.get(k) ?? null,
    setItem: (k: string, v: string) => werte.set(k, v),
    removeItem: (k: string) => werte.delete(k),
  } as unknown as Storage;
};

describe("the pairing on the tablet", () => {
  it("is kept, read and forgotten", () => {
    const s = speicher();
    const kopplung = { token: "t", terminalId: "id", name: "Eingang", betrieb: "Café Elbblick" };
    expect(kopplungLesen(s)).toBeNull();
    kopplungMerken(s, kopplung);
    expect(kopplungLesen(s)).toEqual(kopplung);
    kopplungVergessen(s);
    expect(kopplungLesen(s)).toBeNull();
  });

  it("is none without storage or with something unreadable", () => {
    expect(kopplungLesen(null)).toBeNull();
    const s = speicher();
    s.setItem("soll.kiosk", "{kaputt");
    expect(kopplungLesen(s)).toBeNull();
  });
});

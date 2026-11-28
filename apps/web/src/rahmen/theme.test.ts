import { describe, expect, it } from "vitest";
import { liesThema, speichereThema, themeFarbe } from "./theme.ts";

const ablage = () => {
  const werte = new Map<string, string>();
  return {
    getItem: (key: string) => werte.get(key) ?? null,
    setItem: (key: string, value: string) => void werte.set(key, value),
  };
};

describe("theme", () => {
  it("is system when nothing is stored", () => {
    expect(liesThema(ablage())).toBe("system");
    expect(liesThema(undefined)).toBe("system");
  });

  it("reads back what was stored", () => {
    const a = ablage();
    speichereThema(a, "dunkel");
    expect(liesThema(a)).toBe("dunkel");
  });

  it("ignores unknown values and blocked storage", () => {
    const a = ablage();
    a.setItem("soll-thema", "lila");
    expect(liesThema(a)).toBe("system");
    const gesperrt = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(liesThema(gesperrt)).toBe("system");
    expect(() => speichereThema(gesperrt, "hell")).not.toThrow();
  });

  it("maps manual themes to their browser theme-color and leaves system to media queries (#119)", () => {
    expect(themeFarbe("hell")).toBe("#ffffff");
    expect(themeFarbe("dunkel")).toBe("#09090b");
    expect(themeFarbe("system")).toBeNull();
  });
});

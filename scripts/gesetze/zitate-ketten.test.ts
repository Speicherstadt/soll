import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fehlendeNormen, ladeNormen } from "./liste.ts";
import { regelnJeNorm, zitierteNormen } from "./zitate.ts";

const zitiert = (text: string) => zitierteNormen(text).map((f) => `§ ${f.paragraf} ${f.gesetz}`);
const regeln = readFileSync(new URL("../../docs/regeln.md", import.meta.url), "utf8");

describe("citations docs/regeln.md writes that the parser drops", () => {
  it.each([
    ["§ 7 Abs. 1 Nr. 1 Alt. 2 ArbZG", ["§ 7 ArbZG"]],
    ["§§ 3 Abs. 1 bis 3, 5 ArbZG", ["§ 3 ArbZG", "§ 5 ArbZG"]],
    ["§ 15 bis 18 JArbSchG", ["§ 15 JArbSchG", "§ 16 JArbSchG", "§ 17 JArbSchG", "§ 18 JArbSchG"]],
    ["§ 3 ArbZG, § 4 Abs. 1 ArbSchG", ["§ 3 ArbZG", "§ 4 ArbSchG"]],
    ["§ 2 Abs. 1 Satz 2 und § 5 ArbZG", ["§ 2 ArbZG", "§ 5 ArbZG"]],
    ["§ 4 Abs. 2, § 12 wie oben", []],
  ])("%s", (text, erwartet) => {
    expect(zitiert(text)).toEqual(erwartet);
  });

  it("cites the paragraph of a range inside it (Abs./Nr. … bis …), as R-06 does", () => {
    // docs/regeln.md R-06: "**Norm**: § 2 Abs. 3 bis 5 ArbZG; § 6 Abs. 2 ArbZG"
    expect(zitiert("§ 2 Abs. 3 bis 5 ArbZG")).toEqual(["§ 2 ArbZG"]);
  });

  it("cites the first paragraph of a chain sharing one law (§ x, § y Gesetz)", () => {
    // docs/regeln.md R-17 table: "§ 4 Abs. 2, § 12 JArbSchG"; R-21: "§ 5 Abs. 1 Satz 2, § 28 MuSchG"
    expect(zitiert("§ 4 Abs. 2, § 12 JArbSchG")).toEqual(["§ 4 JArbSchG", "§ 12 JArbSchG"]);
    expect(zitiert("§ 5 Abs. 1 Satz 2, § 28 MuSchG")).toEqual(["§ 5 MuSchG", "§ 28 MuSchG"]);
  });

  it("names R-17 among the rules citing § 4 JArbSchG (the issue text lists them)", () => {
    expect(regelnJeNorm(regeln).get("§ 4 JArbSchG")).toContain("R-17");
  });

  it("lets the coverage test catch an unwatched paragraph or unknown law cited that way", () => {
    // § 14 ArbZG is not in scripts/gesetze/normen.json; NeuG is no known law
    const z = zitierteNormen(
      "§ 14 Abs. 1 bis 3 ArbZG; § 14 Abs. 1, § 15 ArbZG; § 1 Abs. 1 bis 2 NeuG",
    );
    expect(fehlendeNormen(z, ladeNormen())).toEqual({
      fehlen: ["§ 14 ArbZG"],
      unbekannt: ["NeuG"],
    });
  });
});

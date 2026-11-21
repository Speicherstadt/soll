import { describe, expect, it } from "vitest";
import { regelnJeNorm, zitierteNormen } from "./zitate.ts";

const zitiert = (text: string) => zitierteNormen(text).map((f) => `§ ${f.paragraf} ${f.gesetz}`);

describe("the norms a text cites", () => {
  it.each([
    ["§ 3 ArbZG", ["§ 3 ArbZG"]],
    ["§ 3 Abs. 2 Nr. 1 ArbSchG („für eine geeignete Organisation“)", ["§ 3 ArbSchG"]],
    ["§ 7 Abs. 1 Nr. 1 Buchst. a ArbZG", ["§ 7 ArbZG"]],
    ["§ 8 Abs. 1, 1a, 1b SGB IV", ["§ 8 SGB IV"]],
    ["§ 3b Abs. 2 Satz 2, Abs. 3 Nr. 1 EStG", ["§ 3b EStG"]],
    ["§§ 2, 6 Abs. 2 ArbZG", ["§ 2 ArbZG", "§ 6 ArbZG"]],
    ["§§ 15 bis 18 JArbSchG", ["§ 15 JArbSchG", "§ 16 JArbSchG", "§ 17 JArbSchG", "§ 18 JArbSchG"]],
    [
      "§§ 8, 11 bis 13 JArbSchG",
      ["§ 8 JArbSchG", "§ 11 JArbSchG", "§ 12 JArbSchG", "§ 13 JArbSchG"],
    ],
    ["§§ 3 Abs. 1, 4 Abs. 1 EntgFG", ["§ 3 EntgFG", "§ 4 EntgFG"]],
    ["§§ 187 Abs. 2, 188 Abs. 2 und 3 BGB", ["§ 187 BGB", "§ 188 BGB"]],
    ["§§ 15, 16 Abs. 2 Nr. 6, Abs. 3 JArbSchG", ["§ 15 JArbSchG", "§ 16 JArbSchG"]],
    ["§§ 9 bis 10 MuSchG und §§ 22 ff. JArbSchG.", ["§ 9 MuSchG", "§ 10 MuSchG", "§ 22 JArbSchG"]],
    ["§ 208 Abs. 1 Satz 1 SGB IX", ["§ 208 SGB IX"]],
    ["(§ 1 Abs. 1 Satz 1 Nr. 1 SvEV)", ["§ 1 SvEV"]],
    ["| § 9 Abs. 1 ArbZG; § 1 FeiertagsG Hamburg |", ["§ 9 ArbZG", "§ 1 FeiertagsG"]],
    ["eine Zeile\n  § 8 Abs. 1\n  SGB IV", ["§ 8 SGB IV"]],
  ])("%s", (text, erwartet) => {
    expect(zitiert(text)).toEqual(erwartet);
  });

  it("skips a paragraph that names no law, such as a reference back into the text", () => {
    expect(zitiert("§ 5 Abs. 2 wie R-05; § 7, Mo Schicht 7; Art. 9 DSGVO; R 3b LStR")).toEqual([]);
  });

  it("names each paragraph once", () => {
    expect(zitiert("§ 3 ArbZG und § 3 Satz 2 ArbZG")).toEqual(["§ 3 ArbZG"]);
  });

  it("knows which rule cites a paragraph", () => {
    const regeln = "### R-01 Erfassen\n\n§ 3 ArbSchG\n\n### R-02 Tag\n\n§ 3 ArbZG; § 3 ArbSchG\n";
    expect(Object.fromEntries(regelnJeNorm(regeln))).toEqual({
      "§ 3 ArbSchG": ["R-01", "R-02"],
      "§ 3 ArbZG": ["R-02"],
    });
  });
});

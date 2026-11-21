import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ladeNormen, NORMEN_DATEI } from "./liste.ts";
import { normenDatei } from "./normendatei.ts";

describe("writing normen.json", () => {
  it("writes the file exactly as Biome formats it, so lint stays green after --schreiben", () => {
    expect(normenDatei(ladeNormen())).toBe(readFileSync(NORMEN_DATEI, "utf8"));
  });
});

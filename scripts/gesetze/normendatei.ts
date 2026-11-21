/*
 * normen.json as `--schreiben` writes it. Biome formats JSON differently from JSON.stringify, so
 * Biome formats it itself, else `bun run lint` would fail after each write. Copied from
 * firsttris/haben, scripts/jahreswerte/normendatei.ts.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Norm } from "./liste.ts";

const WURZEL = fileURLToPath(new URL("../..", import.meta.url));
const BIOME = fileURLToPath(
  new URL("../../node_modules/@biomejs/biome/bin/biome", import.meta.url),
);
/** The path Biome formats the text as: decides language and settings from biome.json */
const PFAD_IM_REPO = "scripts/gesetze/normen.json";

export function normenDatei(normen: readonly Norm[]): string {
  const biome = spawnSync(
    process.execPath,
    [BIOME, "format", `--stdin-file-path=${PFAD_IM_REPO}`],
    {
      cwd: WURZEL,
      input: JSON.stringify({ normen }),
      encoding: "utf8",
    },
  );
  if (biome.status !== 0)
    throw new Error(`Biome konnte normen.json nicht formatieren: ${biome.stderr}`);
  return biome.stdout;
}

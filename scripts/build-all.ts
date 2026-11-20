/**
 * Builds every workspace that has a "build" script, in workspace order.
 * `bun run --filter` fails when no workspace exists yet; this runs green on an empty repository too.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceDirs = (root: string): string[] =>
  ["packages", "apps"]
    .map((group) => join(root, group))
    .filter((dir) => existsSync(dir))
    .flatMap((dir) => readdirSync(dir).map((name) => join(dir, name)))
    .filter((dir) => existsSync(join(dir, "package.json")));

const hasBuild = (dir: string): boolean =>
  Boolean(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).scripts?.build);

const build = (dir: string): number =>
  Bun.spawnSync(["bun", "run", "build"], { cwd: dir, stdout: "inherit", stderr: "inherit" })
    .exitCode;

const failed = workspaceDirs(process.cwd())
  .filter(hasBuild)
  .filter((dir) => build(dir) !== 0);
if (failed.length > 0) {
  console.error(`Build failed in: ${failed.join(", ")}`);
  process.exit(1);
}

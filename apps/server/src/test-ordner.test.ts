import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { temporaerOrdner } from "./test-ordner.ts";

// A hook registered inside a running test never runs, so testDatenbank() called in a test left its
// directory (soll.db, -wal, -shm) under /tmp until the disk was full (SQLITE_FULL). The fixture runs
// in a child vitest with a TMPDIR of its own, so directories of other runs don't count.

const repo = join(import.meta.dirname, "../../..");
const konfig = join(import.meta.dirname, "test-ordner/vitest.config.ts");

it("removes every test directory, also of a failed or timed-out test", { timeout: 60_000 }, () => {
  const eigenesTmp = temporaerOrdner("soll-aufraeumen-");
  const lauf = spawnSync(process.execPath, ["--bun", "vitest", "run", "--config", konfig], {
    cwd: repo,
    env: { ...process.env, TMPDIR: eigenesTmp, NO_COLOR: "1" },
    encoding: "utf8",
  });
  expect(`${lauf.stdout}${lauf.stderr}`).toMatch(/Tests\s+2 failed \| 6 passed \(8\)/);
  expect(readdirSync(eigenesTmp).filter((name) => name.startsWith("soll-"))).toEqual([]);
});

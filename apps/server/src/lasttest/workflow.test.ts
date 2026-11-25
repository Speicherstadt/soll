// The workflow of the full load test fails when the load test fails (S-904)
import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { temporaerOrdner } from "../test-ordner.ts";

// GitHub Actions runs a `run:` step without `shell:` as `bash -e {0}`, without pipefail
// (docs: "Workflow syntax", jobs.<job_id>.steps[*].shell, "unspecified" on non-Windows)
describe("lasttest.yml", () => {
  it("fails the job when `bun run lasttest` exits non-zero", () => {
    const yml = readFileSync(".github/workflows/lasttest.yml", "utf8");
    const zeile = yml.split("\n").find((z) => z.includes("bun run lasttest"));
    if (!zeile) throw new Error("no lasttest step");
    const befehl = zeile.replace(/^\s*(-\s*)?run:\s*/, "");
    const shell = /shell:\s*bash/.test(yml) ? ["--noprofile", "--norc", "-eo", "pipefail"] : ["-e"];
    const bin = temporaerOrdner("fake-bun-");
    writeFileSync(join(bin, "bun"), "#!/bin/sh\necho FAILED\nexit 1\n");
    chmodSync(join(bin, "bun"), 0o755);
    const r = spawnSync("bash", [...shell, "-c", befehl], {
      cwd: temporaerOrdner("wf-"),
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
    expect(r.status).not.toBe(0);
  });
});

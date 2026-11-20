import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Starts the compiled server binary on a free port and asks /health (BAULISTE.md S-101): the binary
 * that ships must start on its own, not only the sources under Bun.
 */
export const binary = "apps/server/dist/soll";
const port = 28_201;

// An empty data directory: the binary must create the database from its embedded migrations
const dataDir = mkdtempSync(join(tmpdir(), "soll-smoke-"));
const umgebung: Record<string, string | undefined> = {
  ...process.env,
  SOLL_PORT: String(port),
  SOLL_HOST: "127.0.0.1",
  SOLL_DATA_DIR: dataDir,
};
delete umgebung.SOLL_SECRET_KEY;

// Without SOLL_SECRET_KEY the server refuses to start (BAULISTE.md S-106)
const ohneSchluessel = Bun.spawnSync([binary], { env: umgebung, stdout: "pipe", stderr: "pipe" });
if (
  ohneSchluessel.exitCode === 0 ||
  !ohneSchluessel.stderr.toString().includes("SOLL_SECRET_KEY")
) {
  throw new Error(`the binary started without SOLL_SECRET_KEY (exit ${ohneSchluessel.exitCode})`);
}
console.log("binary refuses to start without SOLL_SECRET_KEY");

const server = Bun.spawn([binary], {
  env: {
    ...umgebung,
    SOLL_SECRET_KEY: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"),
  },
  stdout: "inherit",
  stderr: "inherit",
});

const health = async (attempt = 0): Promise<Response> => {
  try {
    return await fetch(`http://127.0.0.1:${port}/health`);
  } catch (error) {
    if (attempt >= 50) throw error;
    await Bun.sleep(100);
    return health(attempt + 1);
  }
};

try {
  const res = await health();
  const body = (await res.json()) as { status?: string };
  if (res.status !== 200 || body.status !== "ok")
    throw new Error(`unexpected answer ${res.status}`);
  console.log("binary answers /health");
  if (!existsSync(join(dataDir, "soll.db"))) throw new Error("no database in the data directory");
  console.log("binary created its database");
} finally {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
}

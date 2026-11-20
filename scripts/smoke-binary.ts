/**
 * Starts the compiled server binary on a free port and asks /health (BAULISTE.md S-101): the binary
 * that ships must start on its own, not only the sources under Bun.
 */
export const binary = "apps/server/dist/soll";
const port = 28_201;

const server = Bun.spawn([binary], {
  env: { ...process.env, SOLL_PORT: String(port), SOLL_HOST: "127.0.0.1" },
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
} finally {
  server.kill();
}

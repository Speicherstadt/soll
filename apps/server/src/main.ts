import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { oeffneDatenbank } from "./db/oeffnen.ts";
import { parseEnv } from "./env.ts";

const env = parseEnv(process.env);
mkdirSync(env.dataDir, { recursive: true });
// Opening applies the migrations embedded in the binary (src/db/migrationen.gen.ts)
oeffneDatenbank(join(env.dataDir, "soll.db"), Date.now());

const app = createApp({
  log: (line) => console.log(line),
  now: Date.now,
  version: env.version,
});

const server = Bun.serve({ port: env.port, hostname: env.host, fetch: app.fetch });
console.log(JSON.stringify({ msg: "listening", url: server.url.href }));

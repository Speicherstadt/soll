import { createApp } from "./app.ts";
import { parseEnv } from "./env.ts";

const env = parseEnv(process.env);
const app = createApp({
  log: (line) => console.log(line),
  now: Date.now,
  version: env.version,
});

const server = Bun.serve({ port: env.port, hostname: env.host, fetch: app.fetch });
console.log(JSON.stringify({ msg: "listening", url: server.url.href }));

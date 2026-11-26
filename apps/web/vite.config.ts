import { readFileSync } from "node:fs";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import { serviceWorker } from "./build/service-worker.ts";

const { version } = JSON.parse(readFileSync("../../package.json", "utf8")) as { version: string };

// The API of the Hono server, reached through Vite under the app's own origin, so the session cookie
// and Better Auth's origin check see one site (dev: 18200, e2e: 28200; CLAUDE.md, "Working rules");
// the MCP server beside it (S-607)
const server = `http://127.0.0.1:${process.env.SOLL_API_PORT ?? "18200"}`;
const api = { "/api": server, "/mcp": server };

// The texts on the dev server come one module per language, not one per message (Paraglide's
// default for Vite): a fresh page fetched some 1250 message modules and under parallel e2e tests
// took longer than a test may run. The build keeps the default, which tree-shakes per message;
// one module per language would load every text in all six languages on every page (shared chunk
// 43 KB → 188 KB gzipped). docs/plan.md, "Entscheidungen"; e2e/dev-server.spec.ts.
const paraglideOutput = (development: boolean) =>
  development ? { outputStructure: "locale-modules" as const } : {};

// The app is a static SPA/PWA; the Hono server serves the API (CLAUDE.md, "Code style")
export default defineConfig(({ command, isPreview }) => ({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    paraglideVitePlugin({
      project: "../../project.inlang",
      outdir: "./src/paraglide",
      strategy: ["localStorage", "cookie", "preferredLanguage", "baseLocale"],
      ...paraglideOutput(command === "serve" && !isPreview),
    }),
    tanstackRouter({ target: "solid", autoCodeSplitting: true }),
    solid(),
    tailwindcss(),
    serviceWorker(),
  ],
  server: { port: 5177, strictPort: true, proxy: api },
  preview: { port: 5177, strictPort: true, proxy: api },
}));

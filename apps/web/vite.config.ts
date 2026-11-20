import { paraglideVitePlugin } from "@inlang/paraglide-js";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import { serviceWorker } from "./build/service-worker.ts";

// The API of the Hono server, reached through Vite under the app's own origin, so the session cookie
// and Better Auth's origin check see one site (dev: 18200, e2e: 28200; CLAUDE.md, "Working rules")
const api = { "/api": `http://127.0.0.1:${process.env.SOLL_API_PORT ?? "18200"}` };

// The app is a static SPA/PWA; the Hono server serves the API (CLAUDE.md, "Code style")
export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: "../../project.inlang",
      outdir: "./src/paraglide",
      strategy: ["localStorage", "cookie", "preferredLanguage", "baseLocale"],
    }),
    tanstackRouter({ target: "solid", autoCodeSplitting: true }),
    solid(),
    tailwindcss(),
    serviceWorker(),
  ],
  server: { port: 5177, strictPort: true, proxy: api },
  preview: { port: 5177, strictPort: true, proxy: api },
});

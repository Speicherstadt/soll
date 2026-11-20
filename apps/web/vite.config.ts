import { paraglideVitePlugin } from "@inlang/paraglide-js";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import { serviceWorker } from "./build/service-worker.ts";

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
  server: { port: 5177, strictPort: true },
  preview: { port: 5177, strictPort: true },
});

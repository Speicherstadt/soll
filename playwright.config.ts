import { defineConfig, devices } from "@playwright/test";

// e2e ports stay clear of the dev ports and of what the user runs (CLAUDE.md, "Working rules")
const WEB_PORT = 5178;
// The production build with its service worker, for what only a build does (e2e/offline.spec.ts)
const PREVIEW_PORT = 5179;
// The API server both forward /api to (scripts/e2e-server.ts)
const API_PORT = 28200;
// A preinstalled Chromium of another Playwright version (cloud sandboxes); CI installs its own
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = executablePath ? { executablePath } : {};
// Without it Playwright ends each server with SIGKILL, and scripts/e2e-server.ts could not remove its
// temporary data directory (soll-e2e-*); with SIGTERM it stops its stand-ins and cleans up
const gracefulShutdown = { signal: "SIGTERM", timeout: 5000 } as const;

/**
 * Three projects (BAULISTE.md S-101): `desktop` runs every test outside e2e/terminal/ (the kiosk
 * view), `phone` the ones tagged @phone, `terminal` the ones tagged @terminal on a tablet in
 * landscape (1280 × 800); the tests in e2e/terminal/ carry @terminal.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // CI: as many workers as the runner has cores (Playwright takes half by default); locally its default
  ...(process.env.CI ? { workers: 4 } : {}),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "off" },
  projects: [
    {
      name: "desktop",
      testIgnore: "terminal/**",
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
    {
      name: "phone",
      grep: /@phone/,
      use: { ...devices["Pixel 7"], launchOptions },
    },
    {
      name: "terminal",
      grep: /@terminal/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        hasTouch: true,
        launchOptions,
      },
    },
  ],
  // Playwright starts these one after another, each once the one before answers. The build comes
  // before the dev server: both let Paraglide write apps/web/src/paraglide (the dev server one module
  // of texts per language, the build one per message; apps/web/vite.config.ts), and a build under a
  // running dev server reloads it and stamps every module anew
  // (e2e/dev-server.spec.ts; docs/plan.md, "Entscheidungen").
  webServer: [
    {
      // the API on a fresh database in a temporary directory (scripts/e2e-server.ts)
      command: `bun scripts/e2e-server.ts`,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      gracefulShutdown,
    },
    {
      command: `bun run --cwd apps/web build && bun run --cwd apps/web preview --port ${PREVIEW_PORT}`,
      env: { SOLL_API_PORT: String(API_PORT) },
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: !process.env.CI,
      gracefulShutdown,
    },
    {
      command: `bun run --cwd apps/web dev --port ${WEB_PORT}`,
      env: { SOLL_API_PORT: String(API_PORT) },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      gracefulShutdown,
    },
  ],
});

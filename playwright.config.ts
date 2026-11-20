import { defineConfig, devices } from "@playwright/test";

// e2e ports stay clear of the dev ports and of what the user runs (CLAUDE.md, "Working rules")
const WEB_PORT = 5178;
// A preinstalled Chromium of another Playwright version (cloud sandboxes); CI installs its own
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = executablePath ? { executablePath } : {};

/**
 * Three projects (BAULISTE.md S-101): `desktop` runs every test outside e2e/terminal/ (the kiosk
 * view), `phone` the ones tagged @phone, `terminal` the ones tagged @terminal on a tablet in
 * landscape (1280 × 800); the tests in e2e/terminal/ carry @terminal.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
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
  webServer: {
    command: `bun run --cwd apps/web dev --port ${WEB_PORT}`,
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});

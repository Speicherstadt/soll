import { defineConfig } from "vitest/config";

// One run over the whole monorepo; packages keep their tests next to the code.
export default defineConfig({
  test: {
    include: ["{apps,packages,scripts}/**/*.test.ts"],
    // The repository starts without code; a run without tests is green until the first package lands
    passWithNoTests: true,
  },
});

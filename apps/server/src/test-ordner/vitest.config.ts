import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

// Runs only the fixtures of test-ordner.test.ts, in a child vitest with a TMPDIR of its own; its cache
// goes there too, so the run leaves nothing next to the code
export default defineConfig({
  cacheDir: join(tmpdir(), "vite"),
  test: {
    root: import.meta.dirname,
    include: ["*.fixture.ts"],
    pool: "threads",
  },
});

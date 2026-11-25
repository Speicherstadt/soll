import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

// Runs only the fixture of test-ordner.test.ts, in a child vitest with a TMPDIR of its own; its cache
// goes there too, so the run leaves nothing next to the code
export default defineConfig({
  cacheDir: join(tmpdir(), "vite"),
  test: {
    root: import.meta.dirname,
    include: ["faelle.fixture.ts"],
    pool: "threads",
  },
});

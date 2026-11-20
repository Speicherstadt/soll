import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrationenQuelle, ORDNER, ZIEL } from "./migrationen.ts";

describe("migrationen.gen.ts", () => {
  it("holds every migration of apps/server/drizzle (run `bun run db:generate`)", () => {
    expect(readFileSync(ZIEL, "utf8")).toBe(migrationenQuelle(ORDNER));
  });
});

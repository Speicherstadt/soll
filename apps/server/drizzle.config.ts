import { defineConfig } from "drizzle-kit";

// Migrations are generated with `bun run db:generate` and never edited afterwards (CLAUDE.md)
export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./drizzle",
});

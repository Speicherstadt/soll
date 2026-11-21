import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* The personal access tokens of the REST API and the MCP server (S-607); re-exported by ../schema.ts */

/**
 * A personal access token of a member in one business. Only the SHA-256 of the token is kept
 * (CLAUDE.md, "API tokens ... as hashes"); `praefix` is its first characters, to recognise it in
 * the list. The token carries the rights of its person's role at the time of each call, never its
 * own. `gueltig_bis` is the instant it expires (null: never); `zuletzt_genutzt` the calendar day in
 * Europe/Berlin of its last use, so a use writes at most one link a day.
 */
export const apiZugaenge = sqliteTable(
  "api_zugaenge",
  {
    betriebId: text("betrieb_id").notNull(),
    zugangId: text("zugang_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    name: text("name").notNull(),
    praefix: text("praefix").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    angelegtAm: integer("angelegt_am").notNull(),
    gueltigBis: integer("gueltig_bis"),
    zuletztGenutzt: text("zuletzt_genutzt"),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.zugangId] }),
    index("api_zugaenge_person").on(t.betriebId, t.nutzerId),
  ],
);

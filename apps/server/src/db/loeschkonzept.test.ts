import { readdirSync, readFileSync } from "node:fs";
import { getTableName } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

/*
 * The Löschkonzept (docs/loeschkonzept.md, S-903) names every table of the database with its
 * deletion class, so a new table cannot be left without a rule (DIN 66398; Art. 5 Abs. 1 lit. e,
 * Art. 17 DSGVO), as auskunft.test.ts does for the Auskunft.
 */

const seite = readFileSync(new URL("../../../../docs/loeschkonzept.md", import.meta.url), "utf8");

const tabellen = (modul: Record<string, unknown>) =>
  Object.values(modul)
    .filter((wert): wert is SQLiteTable => wert instanceof SQLiteTable)
    .map(getTableName);

/**
 * The tables as drizzle-kit finds them: every module the globs of drizzle.config.ts name, so a table
 * not re-exported from schema.ts is found as well
 */
const schemaTabellen = async (): Promise<string[]> => {
  const teile = readdirSync(new URL("./schema/", import.meta.url))
    .filter((datei) => datei.endsWith(".ts") && !datei.endsWith(".test.ts"))
    .map((datei) => `./schema/${datei}`);
  const module = await Promise.all(
    ["./schema.ts", "./auth-schema.ts", ...teile].map(
      (pfad) => import(pfad) as Promise<Record<string, unknown>>,
    ),
  );
  return [...new Set(module.flatMap(tabellen))].sort();
};

/** The tables of the newest migration snapshot, the database as the migrations build it */
const snapshotTabellen = (): string[] => {
  const journal = JSON.parse(
    readFileSync(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  ) as { entries: { idx: number }[] };
  const letzte = Math.max(...journal.entries.map(({ idx }) => idx));
  const snapshot = JSON.parse(
    readFileSync(
      new URL(
        `../../drizzle/meta/${String(letzte).padStart(4, "0")}_snapshot.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { tables: Record<string, unknown> };
  return Object.keys(snapshot.tables).sort();
};

/** The rows of the markdown table under a heading, as cells */
const zeilenUnter = (ueberschrift: string): string[][] => {
  const beginn = seite.indexOf(`\n## ${ueberschrift}\n`);
  if (beginn < 0) throw new Error(`no section ${ueberschrift}`);
  const rest = seite.slice(beginn + ueberschrift.length + 5);
  const ende = rest.indexOf("\n## ");
  return (ende < 0 ? rest : rest.slice(0, ende))
    .split("\n")
    .filter((zeile) => zeile.startsWith("| ") && !zeile.startsWith("| ---"))
    .slice(1) // the header
    .map((zeile) =>
      zeile
        .slice(1, -1)
        .split(" | ")
        .map((zelle) => zelle.trim()),
    );
};

const tabellenzeilen = () => zeilenUnter("Tabellen");
const klassen = () => zeilenUnter("Löschklassen").map(([klasse]) => klasse);

describe("Löschkonzept", () => {
  it("names every table of the schema and of the newest migration, each once", async () => {
    const genannt = tabellenzeilen().map(([tabelle]) => tabelle?.replaceAll("`", ""));
    expect(new Set(genannt).size, "a table named twice").toBe(genannt.length);
    expect([...genannt].sort()).toEqual(await schemaTabellen());
    expect([...genannt].sort()).toEqual(snapshotTabellen());
  });

  it("gives every table a deletion class from the list, and says what Soll does", () => {
    const bekannt = new Set(klassen());
    expect(bekannt.size).toBeGreaterThan(3);
    for (const [tabelle, klasse, inhalt, umsetzung] of tabellenzeilen()) {
      expect(bekannt, `${tabelle}: class ${klasse}`).toContain(klasse);
      expect(inhalt?.length, `${tabelle}: content`).toBeGreaterThan(5);
      expect(umsetzung?.length, `${tabelle}: what Soll does`).toBeGreaterThan(5);
    }
  });

  it("uses every deletion class it defines", () => {
    const benutzt = new Set(tabellenzeilen().map(([, klasse]) => klasse));
    for (const klasse of klassen()) expect(benutzt, klasse).toContain(klasse);
  });
});

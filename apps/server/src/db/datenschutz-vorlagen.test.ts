import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { darf, RECHTE, ROLLEN } from "../auth/rollen.ts";

/*
 * The templates of S-903 (docs/betriebsvereinbarung.md, docs/loeschkonzept.md, docs/infoblatt.md)
 * state what Soll has; these tests fail when the code grows a role or a right the pages do not name.
 * Found by the independent review of S-903.
 */

const lies = (pfad: string) => readFileSync(new URL(pfad, import.meta.url), "utf8");
const bv = lies("../../../../docs/betriebsvereinbarung.md");
const loeschkonzept = lies("../../../../docs/loeschkonzept.md");
const infoblatt = lies("../../../../docs/infoblatt.md");
const de = JSON.parse(lies("../../../../messages/de.json")) as Record<string, string>;

/** The part of a page from one heading to the next given one */
const abschnitt = (seite: string, von: string, bis?: string): string => {
  const beginn = seite.indexOf(von);
  if (beginn < 0) throw new Error(`no part ${von}`);
  const ende = bis ? seite.indexOf(bis, beginn) : -1;
  return ende < 0 ? seite.slice(beginn) : seite.slice(beginn, ende);
};

/** The rows of the markdown tables in a part of a page, as cells, without the header */
const zeilenIn = (teil: string): string[][] =>
  teil
    .split("\n")
    .filter((z) => z.startsWith("| ") && !z.startsWith("| ---"))
    .slice(1)
    .map((z) =>
      z
        .slice(1, -1)
        .split(" | ")
        .map((zelle) => zelle.trim()),
    );

const personenrollen = ROLLEN.filter((r) => r !== "geraet");
const rollenname = (rolle: string) => de[`rolle_${rolle}`] ?? rolle;

describe("templates on data protection (S-903)", () => {
  it("BV § 5 lists every role a person can hold (all but the device)", () => {
    const rollen = zeilenIn(abschnitt(bv, "### § 5", "### § 6")).map(([rolle]) => rolle);
    expect([...rollen].sort()).toEqual(personenrollen.map(rollenname).sort());
  });

  it("BV Anlage 3 lists every right of every role a person can hold, as the server checks them", () => {
    const zeilen = zeilenIn(abschnitt(bv, "### Anlage 3", "Was die Rechte bedeuten"));
    expect(zeilen.map(([rolle]) => rolle).sort()).toEqual(personenrollen.map(rollenname).sort());
    const rechte = new Map(zeilen.map(([rolle, liste]) => [rolle, liste ?? ""]));
    for (const rolle of personenrollen) {
      const genannt = (rechte.get(rollenname(rolle)) ?? "").match(/`[a-z:]+`/g) ?? [];
      const erwartet = RECHTE.filter((recht) => darf(rolle, recht)).map((recht) => `\`${recht}\``);
      expect([...genannt].sort(), rolle).toEqual([...erwartet].sort());
    }
  });

  it("BV Anlage 3 explains every right the server knows", () => {
    const erklaert = zeilenIn(abschnitt(bv, "Was die Rechte bedeuten", "\n---")).map(([recht]) =>
      recht?.replaceAll("`", ""),
    );
    expect([...erklaert].sort()).toEqual([...RECHTE].sort());
  });

  it("BV regulates the import, which Soll has (S-701)", () => {
    expect(bv).not.toContain("Importe aus anderen Programmen hat Soll in dieser Version nicht");
    expect(abschnitt(bv, "### § 6", "### § 7")).toMatch(/Import/);
  });

  it("Löschkonzept names the import file store outside the database", () => {
    expect(abschnitt(loeschkonzept, "## Außerhalb der Datenbank", "\n## L")).toMatch(
      /`\/data\/dateien\/`/,
    );
  });

  it("Infoblatt tells of imported times and the kept original file", () => {
    expect(abschnitt(infoblatt, "### 2.", "### 3.")).toMatch(/[Ii]mport/);
    expect(abschnitt(infoblatt, "### 6.", "### 7.")).toMatch(/Originaldatei/);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lies = (pfad: string) => readFileSync(new URL(pfad, import.meta.url), "utf8");
const loeschkonzept = lies("../../../../docs/loeschkonzept.md");
const infoblatt = lies("../../../../docs/infoblatt.md");
const schlange = lies("../../../web/src/terminal/offline/schlange.ts");

describe("data protection pages match the terminal and access code (S-903)", () => {
  it("Löschkonzept: the tablet's offline queue holds the credential (encrypted), as KioskEintrag does", () => {
    expect(schlange).toMatch(/\/\*\* the credential, encrypted[^\n]*\n\s*ausweis: string;/);
    const zeile = loeschkonzept.split("\n").find((z) => z.startsWith("| Tablet am Eingang"));
    expect(zeile).toBeDefined();
    expect(zeile).not.toMatch(/ohne Ausweis/);
  });

  it("Infoblatt: does not promise to delete the PIN on revocation, which the server cannot do", () => {
    const quellen = (dir: string): string[] =>
      readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? quellen(`${dir}${e.name}/`)
          : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")
            ? [lies(`${dir}${e.name}`)]
            : [],
      );
    const pinLoeschbar = quellen("../").some((q) => /loeschen\(\s*"pins"/.test(q));
    expect(pinLoeschbar).toBe(false);
    const zeile = infoblatt.split("\n").find((z) => z.startsWith("- Zugangsmittel ("));
    expect(zeile).toBeDefined();
    expect(zeile, "promises the PIN is deleted when revoked").not.toMatch(/\(PIN,/);
  });
});

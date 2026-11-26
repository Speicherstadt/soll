import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("documentation links", () => {
  it("resolves every soll.work/*.html link in README.md to a file in docs/", () => {
    const readme = readFileSync("README.md", "utf8");
    const broken: string[] = [];
    for (const match of readme.matchAll(/https:\/\/soll\.work\/([a-z0-9-]+\.html)/g)) {
      const target = `docs/${(match[1] ?? "").replace(/\.html$/, ".md")}`;
      if (!existsSync(target)) broken.push(`${match[0]} -> ${target}`);
    }
    expect(broken).toEqual([]);
  });

  it("resolves every internal .md link in docs/ to an existing file", () => {
    const files = readdirSync("docs").filter((file) => file.endsWith(".md"));
    const broken: string[] = [];
    for (const file of files) {
      const content = readFileSync(join("docs", file), "utf8");
      for (const match of content.matchAll(/\]\(([^)]+\.md(?:#[^)]*)?)\)/g)) {
        const target = (match[1] ?? "").split("#")[0] ?? "";
        if (target.startsWith("http")) continue;
        if (!existsSync(join("docs", target))) broken.push(`${file} -> ${match[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("resolves every .md entry in mkdocs.yml nav to an existing file in docs/", () => {
    const mkdocs = readFileSync("mkdocs.yml", "utf8");
    const navSection = mkdocs.split("\nnav:\n")[1] ?? "";
    const broken: string[] = [];
    for (const match of navSection.matchAll(/:\s*([a-z0-9-]+\.md)\b/g)) {
      const target = join("docs", match[1] ?? "");
      if (!existsSync(target)) broken.push(target);
    }
    expect(broken).toEqual([]);
  });

  // tdd-review S-907: README.md still links to #soll-und-die-alternativen after the section was removed in #91
  it("resolves every internal #anchor link in README.md to a heading", () => {
    const readme = readFileSync("README.md", "utf8");
    const headings = new Set(
      [...readme.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) =>
        (m[1] ?? "")
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, "")
          .replace(/\s+/g, "-"),
      ),
    );
    const broken: string[] = [];
    for (const match of readme.matchAll(/\]\(#([a-z0-9-]+)\)/g)) {
      const anchor = match[1] ?? "";
      if (!headings.has(anchor)) broken.push(match[0]);
    }
    expect(broken).toEqual([]);
  });

  // tdd-review S-907: README.md still says Toggl and Clockify "folgen" / "nächsten Versionen", though both are implemented and marked verfügbar in docs/umzug.md
  it("does not describe already-available import tools as upcoming in README.md", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).not.toMatch(
      /Toggl und Clockify\s+(folgen|liest Soll mit den nächsten Versionen)/,
    );
  });
});

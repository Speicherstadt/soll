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
});

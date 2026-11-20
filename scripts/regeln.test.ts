import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * docs/regeln.md is the specification of every rule packages/arbeitszeit checks (BAULISTE.md S-103):
 * each rule carries the three cases erlaubt, Grenze and Verstoß with a source, and each norm of the
 * table "Rechtlicher Rahmen" in docs/plan.md has a rule.
 */
const regeln = readFileSync("docs/regeln.md", "utf8");
const plan = readFileSync("docs/plan.md", "utf8");

type Regel = { kennung: string; text: string };

const abschnitte = (): Regel[] =>
  regeln
    .split(/^### /m)
    .slice(1)
    .filter((teil) => /^R-\d{2} /.test(teil))
    .map((teil) => ({ kennung: teil.slice(0, 4), text: teil }));

/** The rows of the case table of a rule: cells without the outer pipes */
const faelle = (text: string): string[][] =>
  text
    .split("\n")
    .filter((zeile) => zeile.startsWith("|") && !/^\|\s*-/.test(zeile))
    .slice(1)
    .map((zeile) =>
      zeile
        .slice(1, -1)
        .split("|")
        .map((zelle) => zelle.trim()),
    );

/** The norms of the plan's table "Rechtlicher Rahmen", one per entry between semicolons */
const normenDesPlans = (): string[] => {
  const abschnitt = plan.split("## Rechtlicher Rahmen")[1] ?? "";
  const tabelle = abschnitt.slice(abschnitt.indexOf("| Regel")).split("\n\n")[0] ?? "";
  return tabelle
    .split("\n")
    .slice(2)
    .flatMap((zeile) => (zeile.split("|")[2] ?? "").split(";"))
    .map((norm) => norm.trim())
    .filter((norm) => norm !== "");
};

describe("docs/regeln.md", () => {
  const alle = abschnitte();

  it("numbers its rules R-01 onwards without gaps", () => {
    expect(alle.map((regel) => regel.kennung)).toEqual(
      alle.map((_, index) => `R-${String(index + 1).padStart(2, "0")}`),
    );
    expect(alle.length).toBeGreaterThanOrEqual(30);
  });

  it("gives every rule its norm, its severity and the cases erlaubt, Grenze and Verstoß with a source", () => {
    for (const regel of alle) {
      expect(regel.text, regel.kennung).toMatch(/\*\*Norm\*\*/);
      expect(regel.text, regel.kennung).toMatch(/\*\*Schwere\*\*/);
      const zeilen = faelle(regel.text);
      const arten = zeilen.map((zeile) => zeile[0]);
      for (const art of ["erlaubt", "Grenze", "Verstoß"])
        expect(arten, `${regel.kennung} ${art}`).toContain(art);
      for (const zeile of zeilen)
        expect(zeile.at(-1), `${regel.kennung}: ${zeile.join(" | ")}`).not.toBe("");
    }
  });

  it("has a rule for every norm of the plan's legal framework", () => {
    const normen = normenDesPlans();
    expect(normen.length).toBeGreaterThan(20);
    const zuordnung = new Map(
      regeln
        .split("\n")
        .filter((zeile) => zeile.startsWith("| ") && zeile.includes("| R-"))
        .map((zeile) => {
          const [norm = "", regel = ""] = zeile
            .slice(1, -1)
            .split("|")
            .map((zelle) => zelle.trim());
          return [norm, regel] as const;
        }),
    );
    const vorhanden = new Set(alle.map((regel) => regel.kennung));
    for (const norm of normen.flatMap((n) => [...zuordnung.keys()].filter((k) => k.includes(n)))) {
      const genannt = zuordnung.get(norm)?.match(/R-\d{2}/g) ?? [];
      expect(genannt.length, norm).toBeGreaterThan(0);
      for (const kennung of genannt)
        expect(vorhanden.has(kennung), `${norm} → ${kennung}`).toBe(true);
    }
    const ohneRegel = normen.filter((norm) => ![...zuordnung.keys()].some((k) => k.includes(norm)));
    expect(ohneRegel).toEqual([]);
  });

  it("writes durations as h:mm and never as decimal hours in a case", () => {
    for (const regel of alle) {
      for (const zeile of faelle(regel.text)) {
        expect(zeile.slice(1, -1).join(" "), regel.kennung).not.toMatch(/\b\d+[.,]\d+\s?(h|Std)\b/);
      }
    }
  });
});

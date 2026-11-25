import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aufnahmen,
  BILDSCHIRME,
  dateiName,
  festerTeil,
  GERAETE,
  PIXELDICHTE,
  ZIEL,
} from "./bildschirme.ts";

const ROUTEN = "apps/web/src/routes";
const texte = JSON.parse(readFileSync("messages/de.json", "utf8")) as Record<string, string>;

/** The route file of a path: "/" is index.tsx, "/zeiten" zeiten.tsx (TanStack Router's file routes) */
const routenDatei = (pfad: string) => join(ROUTEN, `${pfad === "/" ? "index" : pfad.slice(1)}.tsx`);

/** Every picture of docs/assets/screenshots/ that README.md or a page of docs/ shows */
const verwiesen = (): Set<string> => {
  const dateien = [
    "README.md",
    ...readdirSync("docs")
      .filter((d) => d.endsWith(".md"))
      .map((d) => join("docs", d)),
  ];
  const muster = /assets\/screenshots\/([a-z-]+\.png)/g;
  return new Set(
    dateien.flatMap((datei) =>
      [...readFileSync(datei, "utf8").matchAll(muster)].map((treffer) => treffer[1] ?? ""),
    ),
  );
};

describe("the screens of the screenshots (S-908)", () => {
  it("has unique names in lowercase", () => {
    const namen = BILDSCHIRME.map((b) => b.name);
    expect(new Set(namen).size).toBe(namen.length);
    for (const name of namen) expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("names each file <name>-<light|dark>-<device>.png", () => {
    expect(dateiName("heute", "dark", "phone")).toBe("heute-dark-phone.png");
    for (const a of aufnahmen(BILDSCHIRME))
      expect(a.datei).toMatch(/^[a-z-]+-(light|dark)-(desktop|phone|terminal)\.png$/);
  });

  it("takes every screen light and dark on each of its devices", () => {
    const liste = aufnahmen(BILDSCHIRME);
    const erwartet = BILDSCHIRME.reduce((summe, b) => summe + b.geraete.length * 2, 0);
    expect(liste).toHaveLength(erwartet);
    expect(new Set(liste.map((a) => a.datei)).size).toBe(liste.length);
  });

  it("picks only the screens named with --nur", () => {
    expect(aufnahmen(BILDSCHIRME, ["terminal"]).map((a) => a.datei)).toEqual([
      "terminal-light-terminal.png",
      "terminal-dark-terminal.png",
    ]);
    expect(aufnahmen(BILDSCHIRME, ["gibt-es-nicht"])).toEqual([]);
  });

  it("shows the terminal only on the tablet and every other screen on desktop and phone", () => {
    for (const b of BILDSCHIRME)
      expect(b.geraete).toEqual(b.wer === "terminal" ? ["terminal"] : ["desktop", "phone"]);
    expect(GERAETE.terminal).toMatchObject({ breite: 1280, hoehe: 800 });
    expect(PIXELDICHTE).toBe(2);
  });

  it("opens only paths the app has a route for", () => {
    for (const b of BILDSCHIRME) expect(existsSync(routenDatei(b.pfad)), b.pfad).toBe(true);
  });

  it("checks headings and waits for texts that messages/de.json has", () => {
    for (const b of BILDSCHIRME) {
      expect(festerTeil(texte[b.titel] ?? ""), b.titel).not.toBe("");
      for (const s of b.schritte ?? [])
        if (typeof s === "object") expect(texte[s.warten], s.warten).toBeDefined();
    }
    expect(festerTeil("Monatsabschluss {monat} · {name}")).toBe("Monatsabschluss");
  });

  it("has a picture for every one README and docs show, and no picture beside the list", () => {
    const liste = new Set(aufnahmen(BILDSCHIRME).map((a) => a.datei));
    for (const datei of verwiesen()) expect(liste.has(datei), datei).toBe(true);
    const vorhanden = existsSync(ZIEL) ? readdirSync(ZIEL) : [];
    for (const datei of vorhanden) expect(liste.has(datei), datei).toBe(true);
    for (const datei of verwiesen()) expect(vorhanden, datei).toContain(datei);
  });
});

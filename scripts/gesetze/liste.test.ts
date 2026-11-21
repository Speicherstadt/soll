import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KINDERKRANKENTAGE,
  MINDESTLOHN,
  MINIJOB_GRENZE,
} from "../../packages/arbeitszeit/src/jahreswerte/index.ts";
import { fehlendeNormen, ladeNormen, NICHT_AUF_GII } from "./liste.ts";
import { zitierteNormen } from "./zitate.ts";

const normen = ladeNormen();
const regeln = readFileSync(new URL("../../docs/regeln.md", import.meta.url), "utf8");

describe("the watch list scripts/gesetze/normen.json", () => {
  it("holds every paragraph docs/regeln.md cites, unless its law is not on gesetze-im-internet.de", () => {
    const zitiert = zitierteNormen(regeln);
    expect(zitiert.length).toBeGreaterThan(50);
    expect(fehlendeNormen(zitiert, normen)).toEqual({ fehlen: [], unbekannt: [] });
  });

  it("names a cited paragraph that is missing, and a law it does not know", () => {
    const zitiert = zitierteNormen("§ 99 ArbZG; § 1 FeiertagsG Hamburg; § 1 NeuG");
    expect(fehlendeNormen(zitiert, normen)).toEqual({
      fehlen: ["§ 99 ArbZG"],
      unbekannt: ["NeuG"],
    });
  });

  it("gives each law it leaves out a reason", () => {
    for (const [gesetz, grund] of Object.entries(NICHT_AUF_GII))
      expect(grund.length, gesetz).toBeGreaterThan(20);
  });

  it("watches the norms behind every yearly value", () => {
    const quellen = [...MINDESTLOHN, ...MINIJOB_GRENZE, ...KINDERKRANKENTAGE].flatMap(
      (wert) => wert.quelle.match(/https:\/\/www\.gesetze-im-internet\.de\/[^\s)]+/g) ?? [],
    );
    expect(quellen.length).toBeGreaterThan(5);
    for (const quelle of quellen)
      expect(
        normen.some((n) => n.url.startsWith(quelle)),
        quelle,
      ).toBe(true);
  });

  it("has a unique key, an address of a single norm and a hash or no state yet for each norm", () => {
    expect(new Set(normen.map((n) => n.id)).size).toBe(normen.length);
    for (const n of normen) {
      const [, paragraf] = /^§ (\d+[a-z]?) /.exec(n.norm) ?? [];
      expect(n.url, n.norm).toMatch(
        /^https:\/\/www\.gesetze-im-internet\.de\/[a-z0-9_]+\/__\d+[a-z]?\.html$/,
      );
      expect(n.url.endsWith(`/__${paragraf}.html`), n.norm).toBe(true);
      expect(n.sha256, n.norm).toMatch(/^([0-9a-f]{64})?$/);
      expect(n.zweck.length, n.norm).toBeGreaterThan(10);
    }
  });
});

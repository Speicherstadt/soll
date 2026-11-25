import { kimaiAbzugText, kimaiLesen } from "@soll/import";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { kimaiAbrufen } from "./kimai-abruf.ts";
import type { Abgerufen } from "./kimai-holen.ts";

/*
 * Fuzzing of the fetch from Kimai (BAULISTE.md S-705): whatever an instance answers (any status,
 * any paging header, any body), the fetch ends with a file or a reason and never throws, and the
 * file it makes is one the reader reads without throwing.
 */

const antwort = fc.oneof(
  fc.constantFrom<Abgerufen>(
    { ok: false, grund: "nicht_erreichbar" },
    { ok: false, grund: "weiterleitung" },
    { ok: false, grund: "zu_gross" },
    { ok: false, grund: "adresse_intern" },
  ),
  fc
    .record({
      status: fc.oneof(fc.constant(200), fc.integer({ min: 100, max: 599 })),
      seiten: fc.oneof(fc.constant("1"), fc.string(), fc.integer({ min: -2, max: 60 }).map(String)),
      text: fc.oneof(
        fc.string(),
        fc.json(),
        fc
          .array(
            fc.dictionary(fc.constantFrom("id", "user", "begin", "end", "name"), fc.jsonValue()),
          )
          .map((l) => JSON.stringify(l)),
      ),
    })
    .map(
      ({ status, seiten, text }): Abgerufen => ({
        ok: true,
        wert: { status, kopf: (name) => (name === "x-total-pages" ? seiten : null), text },
      }),
    ),
);

describe("kimaiAbrufen under fuzzing", () => {
  it("ends with a file or a reason for any answers, and its file reads", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(antwort, { minLength: 1, maxLength: 8 }), async (antworten) => {
        let n = 0;
        const holen = async () => antworten[Math.min(n++, antworten.length - 1)] as Abgerufen;
        const abruf = await kimaiAbrufen(
          { holen, erlaubt: new Set() },
          { instanz: "https://zeit.weber.test", token: "t", benutzer: null },
          { von: "2026-09-01", bis: "2026-09-30" },
        );
        if (!abruf.ok) expect(typeof abruf.grund).toBe("string");
        else kimaiLesen(new TextEncoder().encode(kimaiAbzugText(abruf.wert)));
        expect(n).toBeLessThanOrEqual(4 + 42);
      }),
      { numRuns: 300 },
    );
  });
});

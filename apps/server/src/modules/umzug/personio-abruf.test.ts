import { personioAbzugText, personioLesen } from "@soll/import";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ersatzHolen } from "../../kimai-ersatz.ts";
import { personioErsatz, WEBER_IN_PERSONIO } from "../../personio-ersatz.ts";
import type { Abgerufen } from "./kimai-holen.ts";
import { PERSONIO_API, personioAbrufen } from "./personio-abruf.ts";

/*
 * The fetch from Personio's API v2 (BAULISTE.md S-704): the token, the pages and the revocation
 * against the stand-in, and fuzzing: whatever Personio answers (any status, any body, any next
 * link), the fetch ends with a file or a reason, never throws, never sends the token elsewhere,
 * and its file reads.
 */

const ZUGANG = { clientId: "papi-id", clientSecret: "papi-secret" };
const ZEITRAUM = { von: "2026-09-01", bis: "2026-09-30" };

describe("personioAbrufen", () => {
  it("fetches with a token, follows the cursor and revokes the token", async () => {
    const ersatz = personioErsatz({ ...ZUGANG, daten: WEBER_IN_PERSONIO, seitengroesse: 3 });
    const abruf = await personioAbrufen(
      { holen: ersatzHolen(ersatz.fetch), basis: "https://personio.test" },
      ZUGANG,
      ZEITRAUM,
    );
    expect(abruf.ok && abruf.wert.attendance.length).toBe(8);
    expect(abruf.ok && abruf.wert.person.length).toBe(3);
    expect(ersatz.offeneTokens()).toBe(0);
    const zweite = ersatz.anfragen.find((a) => a.abfrage.has("cursor"));
    expect(zweite?.abfrage.has("start.date_time.gte")).toBe(false);
  });

  it("asks only the public address of Personio when it is the real one", async () => {
    const gefragt: [string, boolean][] = [];
    const holen = async (url: URL, _kopf: Record<string, string>, nurOeffentlich: boolean) => {
      gefragt.push([url.origin, nurOeffentlich]);
      return { ok: false, grund: "nicht_erreichbar" } as const;
    };
    await personioAbrufen({ holen, basis: PERSONIO_API }, ZUGANG, ZEITRAUM);
    expect(gefragt).toEqual([[PERSONIO_API, true]]);
  });
});

const seite = fc
  .record({
    _data: fc.oneof(
      fc.array(
        fc.dictionary(fc.constantFrom("id", "person", "type", "start", "end"), fc.jsonValue()),
      ),
      fc.jsonValue(),
    ),
    _meta: fc.oneof(
      fc.jsonValue(),
      fc.record({
        links: fc.record({
          next: fc.record({
            href: fc.oneof(
              fc.webUrl(),
              fc.string(),
              fc.constant("https://personio.test/v2/persons?cursor=a"),
              fc.constant("/v2/attendance-periods?cursor=b"),
            ),
          }),
        }),
      }),
    ),
  })
  .map((s) => JSON.stringify(s));

const antwort = fc.oneof(
  fc.constantFrom<Abgerufen>(
    { ok: false, grund: "nicht_erreichbar" },
    { ok: false, grund: "weiterleitung" },
    { ok: false, grund: "zu_gross" },
  ),
  fc
    .record({
      status: fc.oneof(fc.constant(200), fc.integer({ min: 100, max: 599 })),
      text: fc.oneof(fc.string(), fc.json(), seite, fc.constant('{"access_token":"papi-t"}')),
    })
    .map(({ status, text }): Abgerufen => ({ ok: true, wert: { status, kopf: () => null, text } })),
);

describe("personioAbrufen under fuzzing", () => {
  it("ends with a file or a reason for any answers, and its file reads", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(antwort, { minLength: 1, maxLength: 12 }), async (antworten) => {
        let n = 0;
        const orte = new Set<string>();
        const holen = async (url: URL) => {
          orte.add(url.origin);
          return antworten[Math.min(n++, antworten.length - 1)] as Abgerufen;
        };
        const abruf = await personioAbrufen(
          { holen, basis: "https://personio.test" },
          ZUGANG,
          ZEITRAUM,
        );
        if (!abruf.ok) expect(typeof abruf.grund).toBe("string");
        else personioLesen(new TextEncoder().encode(personioAbzugText(abruf.wert)));
        expect([...orte]).toEqual(["https://personio.test"]);
      }),
      { numRuns: 300 },
    );
  });
});

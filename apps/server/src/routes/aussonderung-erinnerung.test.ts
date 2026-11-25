/**
 * S-901: a genuine removal that happens while the reminder run awaits a push
 * service. The reminder run took its `jetzt` before the await and writes its next link with it, so
 * a later link carries an earlier time than the removal.
 */
import { describe, expect, it } from "vitest";
import { aussondern } from "../modules/arbeitszeit/index.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import { erinnerungsLauf, type LaufDeps, vapidKontakt } from "../modules/erinnerungen/index.ts";
import { testAbo } from "../modules/erinnerungen/push-test.ts";
import { TEST_URL } from "../test-server.ts";
import { PFAD } from "./erinnerungen-testhilfen.ts";
import { abgeschlossen, pruefen, um } from "./monat-testhilfen.ts";

describe("a removal during a reminder run (S-901)", () => {
  it("still recognises October 2026 as removed", async () => {
    const { server, jonas, sandra, pruefwert } = await abgeschlossen();
    for (const [wer, name] of [
      [jonas, "jonas"],
      [sandra, "sandra"],
    ] as const) {
      const abo = testAbo(`https://fcm.googleapis.com/fcm/send/${name}`);
      expect(
        (await wer.anfrage(`${PFAD}/abos`, { body: { ...abo.json, sprache: "de" } })).status,
      ).toBe(201);
      server.stelleUhr(um("2029-01-02T07:00:00+01:00"));
      expect(
        (await wer.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art: "kommen" } })).status,
      ).toBe(201);
    }
    const lauf = um("2029-01-02T17:00:00+01:00");
    server.stelleUhr(lauf);
    let entfernt = 0;
    const deps: LaufDeps = {
      db: server.db,
      schreibDb: server.schreibDb,
      geheimerSchluessel: server.geheimerSchluessel,
      vapid: server.vapid,
      url: TEST_URL,
      kontakt: vapidKontakt(TEST_URL, "Soll <soll@weber.test>"),
      // the first push takes a few seconds; meanwhile the six-hourly removal runs (serve.ts)
      push: async () => {
        if (entfernt === 0) {
          server.stelleUhr(lauf + 3_000);
          entfernt = aussondern(server.db, server.schreibDb, lauf + 3_000).ausgesondert.length;
        }
        return { status: 201 };
      },
      mail: null,
    };
    expect((await erinnerungsLauf(deps, lauf)).map((g) => g.kanal)).toEqual(["push", "push"]);
    expect(entfernt).toBe(1);
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
    server.stelleUhr(um("2036-01-01T00:00:00+01:00"));
    expect(await pruefen(server, jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "ausgesondert",
      monat: "2026-10",
    });
  });
});

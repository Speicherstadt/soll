import { describe, expect, it } from "vitest";
import { TEST_URL, testServer } from "../test-server.ts";
import { auswerten } from "./auswertung.ts";
import { alleStempeln, aufbauen, lastLaufen, STEMPELN } from "./lauf.ts";
import { pruefen } from "./pruefung.ts";

// The small load test in the normal run (BAULISTE.md S-904): the same code as `bun run lasttest`,
// on the app in this process instead of a server over the network, with 5 businesses of 10 people.
// The latency threshold is for the full run only: a shared CI runner gives no reliable times here.
const angaben = (server: ReturnType<typeof testServer>, betriebe: number, personen: number) => ({
  url: TEST_URL,
  holen: async (url: string, init: RequestInit) => server.app.request(url, init),
  betriebe,
  personen,
  gleichzeitig: 5,
});

describe("load test, small (S-904)", () => {
  it("lands every stamp of 5 businesses with 10 people each exactly once, and the chains verify", async () => {
    const server = testServer();
    const ergebnis = await lastLaufen(angaben(server, 5, 10));
    const auswertung = auswerten(ergebnis.messungen, 50, { p95Ms: Infinity, maxMs: Infinity });
    expect(auswertung).toMatchObject({ anzahl: 50, fehler: 0, status: {}, bestanden: true });
    expect(pruefen(server.db, ergebnis.betriebIds, ergebnis.personen)).toMatchObject({
      gestempelt: 50,
      nichtGenauEinmal: 0,
      kettenMitBefund: 0,
      ok: true,
    });
  }, 60_000);

  it("keeps SQLite at synchronous FULL: a confirmed stamp survives a power cut (docs/plan.md)", () => {
    const server = testServer();
    expect(server.sqlite.query("PRAGMA synchronous").get()).toEqual({ synchronous: 2 });
    expect(server.sqlite.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
  });

  it("finds a second stamp, a missing one and a broken chain", async () => {
    const server = testServer();
    const { betriebIds, personen } = await aufbauen(angaben(server, 2, 3));
    const [erste, zweite] = personen;
    if (!erste || !zweite) throw new Error("no people");
    await alleStempeln(personen.slice(1));
    // a second "kommen" a minute later is a real second stamp, not a double tap (docs/plan.md)
    server.stelleUhr(server.jetzt() + 60_000);
    expect((await zweite.anfrage(STEMPELN, { art: "kommen" })).status).toBe(201);
    expect(pruefen(server.db, betriebIds, personen)).toMatchObject({
      gestempelt: 6,
      nichtGenauEinmal: 2,
      ok: false,
    });
    server.sqlite.run("UPDATE stempelungen SET zeitpunkt = zeitpunkt + 1 WHERE nutzer_id = ?", [
      zweite.nutzerId,
    ]);
    expect(pruefen(server.db, betriebIds, personen).kettenMitBefund).toBe(1);
  }, 60_000);
});

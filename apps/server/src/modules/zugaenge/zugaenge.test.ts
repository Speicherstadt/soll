import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { sha256 } from "../audit/hash.ts";
import { kettePruefen } from "../audit/index.ts";
import { ratenGrenze } from "./grenze.ts";
import {
  nutzungMerken,
  zugaengeVon,
  zugangAnlegen,
  zugangFinden,
  zugangWiderrufen,
} from "./index.ts";

// 2026-09-21 16:13 in Berlin
const JETZT = 1_790_000_000_000;
const TAG_MS = 24 * 60 * 60 * 1000;
const weber = { betriebId: "weber", akteur: "sandra", jetzt: JETZT };

describe("a personal access token", () => {
  it("is shown once and stored only as its SHA-256 with a short prefix", () => {
    const { db, schreibDb, sqlite } = testDatenbank();
    const { token, zugang } = zugangAnlegen(schreibDb, weber, { name: "Excel", gueltigTage: null });
    expect(token).toMatch(/^soll_[A-Za-z0-9_-]{43}$/);
    expect(zugang.praefix).toBe(token.slice(0, 9));
    const zeilen = sqlite.query("SELECT * FROM api_zugaenge").all() as Record<string, unknown>[];
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.token_hash).toBe(sha256(token));
    expect(JSON.stringify(zeilen)).not.toContain(token);
    expect(JSON.stringify(sqlite.query("SELECT inhalt FROM audit_inhalte").all())).not.toContain(
      token,
    );
    expect(zugaengeVon(db, "weber", "sandra")).toEqual([zugang]);
    expect(kettePruefen(db, "weber")).toEqual([]);
  });

  it("is found by the token while valid, not after it expired", () => {
    const { db, schreibDb } = testDatenbank();
    const { token } = zugangAnlegen(schreibDb, weber, { name: "Kurz", gueltigTage: 30 });
    expect(zugangFinden(db, token, JETZT)).toMatchObject({ ok: true });
    expect(zugangFinden(db, token, JETZT + 30 * TAG_MS - 1)).toMatchObject({ ok: true });
    expect(zugangFinden(db, token, JETZT + 30 * TAG_MS)).toEqual({
      ok: false,
      grund: "abgelaufen",
    });
    expect(zugangFinden(db, `${token}x`, JETZT)).toEqual({ ok: false, grund: "ungueltig" });
    expect(zugangFinden(db, "soll_", JETZT)).toEqual({ ok: false, grund: "ungueltig" });
  });

  it("is revoked only by its own person in its own business", () => {
    const { db, schreibDb } = testDatenbank();
    const { token, zugang } = zugangAnlegen(schreibDb, weber, { name: "A", gueltigTage: null });
    const max = { ...weber, akteur: "max" };
    expect(zugangWiderrufen(db, schreibDb, max, zugang.zugangId)).toBe(false);
    const fremd = { ...weber, betriebId: "elbblick" };
    expect(zugangWiderrufen(db, schreibDb, fremd, zugang.zugangId)).toBe(false);
    expect(zugangFinden(db, token, JETZT)).toMatchObject({ ok: true });
    expect(zugangWiderrufen(db, schreibDb, weber, zugang.zugangId)).toBe(true);
    expect(zugangFinden(db, token, JETZT)).toEqual({ ok: false, grund: "ungueltig" });
    expect(zugaengeVon(db, "weber", "sandra")).toEqual([]);
    expect(kettePruefen(db, "weber")).toEqual([]);
  });

  it("remembers the day of its last use with at most one link a day", () => {
    const { db, schreibDb, sqlite } = testDatenbank();
    const { token } = zugangAnlegen(schreibDb, weber, { name: "A", gueltigTage: null });
    const glieder = () =>
      (sqlite.query("SELECT COUNT(*) AS n FROM audit_glieder").get() as { n: number }).n;
    const vorher = glieder();
    const finden = (jetzt: number) => {
      const gefunden = zugangFinden(db, token, jetzt);
      if (!gefunden.ok) throw new Error("not found");
      return gefunden.zugang;
    };
    nutzungMerken(schreibDb, finden(JETZT), JETZT);
    nutzungMerken(schreibDb, finden(JETZT + 1000), JETZT + 1000);
    expect(glieder()).toBe(vorher + 1);
    expect(zugaengeVon(db, "weber", "sandra")[0]?.zuletztGenutzt).toBe("2026-09-21");
    nutzungMerken(schreibDb, finden(JETZT + TAG_MS), JETZT + TAG_MS);
    expect(glieder()).toBe(vorher + 2);
    expect(zugaengeVon(db, "weber", "sandra")[0]?.zuletztGenutzt).toBe("2026-09-22");
  });
});

describe("the rate limit", () => {
  it("lets 120 calls a minute through per token and names the seconds to wait", () => {
    const grenze = ratenGrenze();
    for (let i = 0; i < 120; i++) expect(grenze("a", JETZT + i)).toEqual({ ok: true });
    expect(grenze("a", JETZT + 30_000)).toEqual({ ok: false, wartenSekunden: 30 });
    expect(grenze("b", JETZT + 30_000)).toEqual({ ok: true });
    expect(grenze("a", JETZT + 60_000)).toEqual({ ok: true });
  });
});

import { describe, expect, it } from "vitest";
import { sha256 } from "./abruf.ts";
import { ARBZG_3, latin1 } from "./fixtures.ts";
import type { Norm } from "./liste.ts";
import { antwort, nachgestellt, netzwerkfehler } from "./nachgestellt.ts";
import { mitAktuellenHashes, pruefeNormen } from "./normen.ts";
import { normText } from "./normtext.ts";

const ROH = latin1(ARBZG_3);
const URL_3 = "https://www.gesetze-im-internet.de/arbzg/__3.html";
const seite = (bytes = ROH) => ({ status: 200, bytes, headers: { "content-type": "text/html" } });
const geaendert = () => {
  const html = ARBZG_3.replace("zehn Stunden", "zwölf Stunden");
  return { status: 200, text: html, headers: { "content-type": "text/html; charset=utf-8" } };
};
const HASH = await sha256(normText(ARBZG_3) ?? "");
const norm = (hash: string): Norm => ({
  id: "arbzg-3",
  norm: "§ 3 ArbZG",
  url: URL_3,
  zweck: "Höchstarbeitszeit",
  sha256: hash,
});
const REGELN = new Map([["§ 3 ArbZG", ["R-02", "R-03"]]]);

describe("checking the norms", () => {
  it("finds nothing when the text is the same", async () => {
    const { ergebnis, stand } = await pruefeNormen(
      [norm(HASH)],
      REGELN,
      nachgestellt({ [URL_3]: seite() }),
    );
    expect(ergebnis).toEqual({ befunde: [], warnungen: [] });
    expect(stand).toEqual([{ norm: norm(HASH), sha256: HASH, zustand: "gleich" }]);
  });

  it("reports a changed norm with its address, its purpose, the rules citing it and both hashes", async () => {
    const { ergebnis, stand } = await pruefeNormen(
      [norm(HASH)],
      REGELN,
      nachgestellt({ [URL_3]: geaendert() }),
    );
    expect(ergebnis.warnungen).toEqual([]);
    const [b] = ergebnis.befunde;
    expect(b?.schluessel).toBe("norm-arbzg-3");
    expect(b?.titel).toBe("§ 3 ArbZG geändert");
    for (const teil of [
      URL_3,
      "Höchstarbeitszeit",
      "R-02, R-03",
      HASH,
      stand[0]?.sha256 ?? "-",
      "--schreiben",
    ])
      expect(b?.text).toContain(teil);
    expect(stand[0]?.zustand).toBe("geaendert");
  });

  it("treats a norm without a hash as no state yet: no finding, and --schreiben takes the hash over", async () => {
    const { ergebnis, stand } = await pruefeNormen(
      [norm("")],
      REGELN,
      nachgestellt({ [URL_3]: seite() }),
    );
    expect(ergebnis).toEqual({ befunde: [], warnungen: [] });
    expect(stand[0]?.zustand).toBe("neu");
    expect(mitAktuellenHashes(stand)[0]?.sha256).toBe(HASH);
  });

  it("warns, keeping the old hash, when the source does not answer or shows no single norm", async () => {
    for (const quelle of [antwort(503), netzwerkfehler, antwort(200, "<html>Wartung</html>")]) {
      const { ergebnis, stand } = await pruefeNormen(
        [norm(HASH)],
        REGELN,
        nachgestellt({ [URL_3]: quelle }),
      );
      expect(ergebnis.befunde).toEqual([]);
      expect(ergebnis.warnungen).toHaveLength(1);
      expect(ergebnis.warnungen[0]).toContain("§ 3 ArbZG");
      expect(stand[0]?.zustand).toBe("fehler");
      expect(mitAktuellenHashes(stand)[0]?.sha256).toBe(HASH);
    }
  });

  it("reports a norm that is gone (404) as a finding, also without a hash", async () => {
    for (const hash of [HASH, ""]) {
      const { ergebnis, stand } = await pruefeNormen([norm(hash)], REGELN, nachgestellt({}));
      expect(ergebnis.befunde.map((b) => b.titel)).toEqual(["§ 3 ArbZG ist nicht mehr abrufbar"]);
      expect(stand[0]?.zustand).toBe("weg");
    }
  });
});

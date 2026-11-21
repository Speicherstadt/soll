import { describe, expect, it } from "vitest";
import {
  kinderkrankentage,
  mindestlohnAm,
  minijobGrenzeAm,
} from "../../packages/arbeitszeit/src/jahreswerte/index.ts";
import { ARBZG_3, latin1 } from "./fixtures.ts";
import { bericht, pruefeAlles } from "./gesetze.ts";
import type { Norm } from "./liste.ts";
import { antwort, nachgestellt } from "./nachgestellt.ts";

const ROH = latin1(ARBZG_3);
const GII = "https://www.gesetze-im-internet.de";
const norm = (id: string, paragraf: string, sha256 = ""): Norm => ({
  id,
  norm: `§ ${paragraf} ArbZG`,
  url: `${GII}/arbzg/__${paragraf}.html`,
  zweck: "Arbeitszeit",
  sha256,
});
const WERTE = { mindestlohnAm, minijobGrenzeAm, kinderkrankentage };
const REGELN = "### R-02 Tag\n\n§ 3 ArbZG\n";
const seite = { status: 200, bytes: ROH, headers: { "content-type": "text/html" } };

const lauf = (heute: string, normen: Norm[], antworten = {}) =>
  pruefeAlles(
    { heute, normen, regeln: REGELN, werte: WERTE, bekannteMiLoV: 5 },
    nachgestellt(antworten),
  );

describe("a run of the Gesetzeswächter", () => {
  it("on the first run with no state finds nothing, so no issue is opened, and reports the hashes", async () => {
    const { ergebnis, stand } = await lauf("2026-11-21", [norm("arbzg-3", "3")], {
      [`${GII}/arbzg/__3.html`]: seite,
    });
    expect(ergebnis).toEqual({ befunde: [], warnungen: [] });
    const text = bericht("2026-11-21", ergebnis, stand);
    expect(text).toContain("## Noch kein Stand");
    expect(text).toContain(`§ 3 ArbZG: \`${stand[0]?.sha256}\``);
    expect(text).toContain("Keine Befunde");
  });

  it("brings changed norms and missing yearly values together", async () => {
    const { ergebnis, stand } = await lauf("2027-10-04", [norm("arbzg-3", "3", "0".repeat(64))], {
      [`${GII}/arbzg/__3.html`]: seite,
      [`${GII}/milov6/`]: antwort(503),
    });
    expect(ergebnis.befunde.map((b) => b.titel)).toEqual([
      "§ 3 ArbZG geändert",
      "Mindestlohn 2028 nicht hinterlegt",
      "Minijob-Grenze 2028 nicht hinterlegt",
      "Kinderkrankentage 2028 nicht hinterlegt",
    ]);
    expect(ergebnis.befunde[0]?.text).toContain("R-02");
    const text = bericht("2027-10-04", ergebnis, stand);
    expect(text).toContain("1 Norm(en) beobachtet: 0 gleich, 1 geändert");
    expect(text).toContain("### Mindestlohn 2028 nicht hinterlegt");
    expect(text).toContain("## Warnungen");
    expect(text).toContain("milov6");
  });

  it("names in the report a norm that could not be fetched yet and has no state", async () => {
    const { ergebnis, stand } = await lauf("2026-11-21", [norm("arbzg-4", "4")], {
      [`${GII}/arbzg/__4.html`]: antwort(503),
    });
    expect(ergebnis.befunde).toEqual([]);
    expect(bericht("2026-11-21", ergebnis, stand)).toContain("§ 4 ArbZG: noch nicht erreicht");
  });
});

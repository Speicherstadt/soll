import { describe, expect, it } from "vitest";
import { abrufen, text } from "./abruf.ts";
import { ARBZG_3, latin1 } from "./fixtures.ts";
import { nachgestellt } from "./nachgestellt.ts";
import { normText } from "./normtext.ts";

const ROH = latin1(ARBZG_3);
const URL_3 = "https://www.gesetze-im-internet.de/arbzg/__3.html";
const ERWARTET =
  "Arbeitszeitgesetz (ArbZG) § 3 Arbeitszeit der Arbeitnehmer Die werktägliche Arbeitszeit der " +
  "Arbeitnehmer darf acht Stunden nicht überschreiten. Sie kann auf bis zu zehn Stunden nur " +
  "verlängert werden, wenn innerhalb von sechs Kalendermonaten oder innerhalb von 24 Wochen im " +
  "Durchschnitt acht Stunden werktäglich nicht überschritten werden.";

const seite = () => ARBZG_3;

describe("the text of a norm", () => {
  it("takes heading and text without navigation, anchor, logo and footer", () => {
    expect(normText(seite())).toBe(ERWARTET);
  });

  it("reads the ISO-8859-1 bytes after the meta element when the header names no charset", async () => {
    const holen = nachgestellt({
      [URL_3]: { status: 200, bytes: ROH, headers: { "content-type": "text/html" } },
    });
    const a = await abrufen(holen, URL_3);
    expect(a.art === "antwort" && normText(text(a))).toBe(ERWARTET);
  });

  it("does not change with navigation, the date in the footer, entities or white space", () => {
    const anders = seite()
      .replace("__4.html", "__4a.html")
      .replace("Stand: 20.11.2026", "Stand: 27.11.2026")
      .replace("werktägliche", "werkt&auml;gliche")
      .replace("acht Stunden nicht", "acht\n   Stunden&nbsp;nicht")
      .replace("BJNE000300000", "BJNE000300001");
    expect(normText(anders)).toBe(ERWARTET);
  });

  it("changes with one word of the text, the heading or a footnote", () => {
    expect(normText(seite().replace("zehn Stunden", "zwölf Stunden"))).not.toBe(ERWARTET);
    expect(normText(seite().replace("der Arbeitnehmer</span>", "</span>"))).not.toBe(ERWARTET);
    const mitFussnote = seite().replace(
      '<div id="fusszeile">',
      '<div class="jnfussnote"><div class="jnhtml">§ 3: IdF d. Art. 1 G v. 1.1.2027</div></div><div id="fusszeile">',
    );
    expect(normText(mitFussnote)).toBe(`${ERWARTET} § 3: IdF d. Art. 1 G v. 1.1.2027`);
  });

  it("knows a page that is no single norm", () => {
    expect(normText("<html><body>Wartungsarbeiten</body></html>")).toBeNull();
  });
});

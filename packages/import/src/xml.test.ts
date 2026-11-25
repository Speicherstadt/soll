import { describe, expect, it } from "vitest";
import { merkmaleAus, textAus, xmlDurchlaufen } from "./xml.ts";

/** Every event of a document as a line, for comparing */
const ereignisse = (xml: string): string[] | null => {
  const liste: string[] = [];
  const ok = xmlDurchlaufen(xml, {
    start: (name, m, leer) => liste.push(`<${name} ${JSON.stringify(m)}${leer ? "/" : ""}>`),
    ende: (name) => liste.push(`</${name}>`),
    text: (roh) => liste.push(textAus(roh)),
  });
  return ok ? liste : null;
};

describe("the small XML reader (S-702)", () => {
  it("reads tags, attributes and text, without namespace prefixes", () => {
    expect(
      ereignisse('<?xml version="1.0"?><x:row r="2"><c r=\'A2\' t="s"><v>3</v></c><c/></x:row>'),
    ).toEqual([
      '<row {"r":"2"}>',
      '<c {"r":"A2","t":"s"}>',
      "<v {}>",
      "3",
      "</v>",
      "</c>",
      "<c {}/>",
      "</c>",
      "</row>",
    ]);
  });

  it("resolves the five entities and character references, nothing else", () => {
    expect(textAus("a &lt;b&gt; &amp; &quot;c&quot; &apos;d&apos; &#228;&#xFC; &nbsp; &")).toBe(
      "a <b> & \"c\" 'd' äü &nbsp; &",
    );
    expect(textAus("&#0; &#xD800; &#x110000;")).toBe("&#0; &#xD800; &#x110000;");
    expect(merkmaleAus(" a=\"x &gt; y\" b='1'")).toEqual({ a: "x > y", b: "1" });
  });

  it("refuses a DTD, so no entity is ever expanded and nothing outside is read", () => {
    const lachen = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><t>&lol2;</t>`;
    expect(xmlDurchlaufen(lachen, {})).toBe(false);
    const xxe = `<!DOCTYPE t [<!ENTITY x SYSTEM "file:///etc/passwd">]><t>&x;</t>`;
    expect(xmlDurchlaufen(xxe, {})).toBe(false);
    expect(xmlDurchlaufen("<t><!ELEMENT t ANY></t>", {})).toBe(false);
  });

  it("skips comments and keeps CDATA as text, literally", () => {
    expect(ereignisse("<t><!-- <x> --><![CDATA[a &lt; <b>]]></t>")).toEqual([
      "<t {}>",
      "a &lt; <b>",
      "</t>",
    ]);
  });

  it("refuses what it cannot close, and reads `>` inside a value", () => {
    expect(xmlDurchlaufen("<t a='1", {})).toBe(false);
    expect(xmlDurchlaufen("<t><!-- open", {})).toBe(false);
    expect(ereignisse('<t a="1>2">x</t>')).toEqual(['<t {"a":"1>2"}>', "x", "</t>"]);
  });

  it("stays linear on long runs of what it searches for", () => {
    const start = performance.now();
    xmlDurchlaufen(`<t>${"&".repeat(2_000_000)}</t>`, { text: (roh) => void textAus(roh) });
    xmlDurchlaufen(`<t ${"a".repeat(2_000_000)}>`, {});
    xmlDurchlaufen("<".repeat(200_000), {});
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

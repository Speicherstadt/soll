import { describe, expect, it } from "vitest";
import { sunPruefen } from "./sun.ts";
import { sunErzeugen } from "./sun-erzeugen.ts";

const NULL = new Uint8Array(16);
const schluessel = (meta: string, datei: string) => ({
  meta: Buffer.from(meta, "hex"),
  datei: Buffer.from(datei, "hex"),
});

describe("the SUN message of an NTAG 424 DNA (AN12196)", () => {
  it("reads UID and read counter from the example of AN12196, section 3.4 (page 12)", () => {
    // https://ntag.nxp.com/424?e=EF963FF7828658A599F3041510671E88&c=94EED9EE65337086, keys all zero;
    // the same values in nfc-developer/sdm-backend, tests/test_libsdm.py, test_sun1
    expect(
      sunPruefen(
        { meta: NULL, datei: NULL },
        { e: "EF963FF7828658A599F3041510671E88", c: "94EED9EE65337086" },
      ),
    ).toEqual({ ok: true, uid: "04DE5F1EACC040", zaehler: 61 });
  });

  it("refuses the example with one changed digit of the MAC", () => {
    expect(
      sunPruefen(
        { meta: NULL, datei: NULL },
        { e: "EF963FF7828658A599F3041510671E88", c: "94EED9EE65337087" },
      ),
    ).toEqual({ ok: false });
  });

  it("accepts lower case hex as a reader may give it", () => {
    const ergebnis = sunPruefen(
      { meta: NULL, datei: NULL },
      { e: "ef963ff7828658a599f3041510671e88", c: "94eed9ee65337086" },
    );
    expect(ergebnis.ok).toBe(true);
  });

  const karte = schluessel("42aff114f2cb3b6141be6dc95dfc5416", "b62a9baf092439bd43c62aee96b970c5");

  it("verifies a message made with the card's own keys", () => {
    const sun = sunErzeugen(karte, "041D3C8A2D6B80", 291);
    expect(sunPruefen(karte, sun)).toEqual({ ok: true, uid: "041D3C8A2D6B80", zaehler: 291 });
  });

  it("verifies the message the card in e2e/terminal/nfc.spec.ts sends", () => {
    expect(
      sunPruefen(karte, { e: "8A38BAD78521637B55C86468ECA62085", c: "2BE17FD093495F7D" }),
    ).toEqual({ ok: true, uid: "041D3C8A2D6B80", zaehler: 5 });
  });

  it("refuses a message under another SDMMetaReadKey or SDMFileReadKey", () => {
    const sun = sunErzeugen(karte, "041D3C8A2D6B80", 7);
    expect(sunPruefen({ ...karte, meta: NULL }, sun)).toEqual({ ok: false });
    expect(sunPruefen({ ...karte, datei: NULL }, sun)).toEqual({ ok: false });
  });

  it("refuses PICCData that does not mirror a UID of 7 bytes and the counter", () => {
    const sun = sunErzeugen(karte, "041D3C8A2D6B80", 7, { tag: 0x87 });
    expect(sunPruefen(karte, sun)).toEqual({ ok: false });
  });

  it("refuses values of the wrong length or not in hex", () => {
    expect(sunPruefen(karte, { e: "00", c: "94EED9EE65337086" })).toEqual({ ok: false });
    expect(sunPruefen(karte, { e: "Z".repeat(32), c: "94EED9EE65337086" })).toEqual({ ok: false });
  });
});

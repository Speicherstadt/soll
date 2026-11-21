import { describe, expect, it } from "vitest";
import { karteAus, sunAusUrl } from "./nfc.ts";

const url = (text: string) => ({
  recordType: "url",
  data: new DataView(new TextEncoder().encode(text).buffer),
});

describe("what the kiosk reads from an NFC card (S-802)", () => {
  it("takes PICCData and MAC from the URL of an NTAG 424 DNA (AN12196, e and c)", () => {
    expect(
      sunAusUrl("https://ntag.nxp.com/424?e=EF963FF7828658A599F3041510671E88&c=94EED9EE65337086"),
    ).toEqual({ e: "EF963FF7828658A599F3041510671E88", c: "94EED9EE65337086" });
    expect(
      sunAusUrl(
        "https://soll.test/k?picc_data=EF963FF7828658A599F3041510671E88&cmac=94EED9EE65337086",
      ),
    ).toEqual({ e: "EF963FF7828658A599F3041510671E88", c: "94EED9EE65337086" });
  });

  it("finds no SUN message in a URL without both values or with wrong lengths", () => {
    expect(sunAusUrl("https://soll.test/")).toBeNull();
    expect(sunAusUrl("https://soll.test/?e=EF96&c=94EED9EE65337086")).toBeNull();
    expect(sunAusUrl("kein url")).toBeNull();
  });

  it("reads an NTAG 424 DNA with its SUN message", () => {
    const karte = karteAus({
      serialNumber: "04:de:5f:1e:ac:c0:40",
      message: {
        records: [url("https://soll.test/?e=EF963FF7828658A599F3041510671E88&c=94EED9EE65337086")],
      },
    });
    expect(karte).toEqual({
      uid: "04:de:5f:1e:ac:c0:40",
      sun: { e: "EF963FF7828658A599F3041510671E88", c: "94EED9EE65337086" },
    });
  });

  it("reads a plain card by its serial number only", () => {
    expect(karteAus({ serialNumber: "04:a1:b2:c3", message: { records: [] } })).toEqual({
      uid: "04:a1:b2:c3",
      sun: null,
    });
    expect(
      karteAus({ serialNumber: "04:a1:b2:c3", message: { records: [url("https://x.test/")] } }),
    ).toEqual({ uid: "04:a1:b2:c3", sun: null });
  });

  it("reads nothing from a card without serial number or SUN message", () => {
    expect(karteAus({ serialNumber: "", message: { records: [] } })).toBeNull();
    expect(karteAus({})).toBeNull();
  });
});

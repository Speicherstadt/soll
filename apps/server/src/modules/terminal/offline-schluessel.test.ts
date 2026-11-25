import { createECDH } from "node:crypto";
import { ausweisVerschluesseln } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import { ausweisOeffnen, ausweisSchluesselAus } from "./offline-schluessel.ts";

const geheim = (byte: number) => new Uint8Array(32).fill(byte);
const TERMINAL = "0b7c2f1e-1d4f-4c7e-9a43-2c1f0e9b7d10";

describe("the server's key for credentials in the offline queue (S-803)", () => {
  it("is the same from the same secret and another from another", () => {
    expect(ausweisSchluesselAus(geheim(7))).toEqual(ausweisSchluesselAus(geheim(7)));
    expect(ausweisSchluesselAus(geheim(8)).oeffentlich).not.toEqual(
      ausweisSchluesselAus(geheim(7)).oeffentlich,
    );
  });

  it("is a point of P-256 that belongs to the private scalar", () => {
    const { privat, oeffentlich } = ausweisSchluesselAus(geheim(7));
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(privat);
    const punkt = ecdh.getPublicKey();
    expect(oeffentlich).toEqual({
      kty: "EC",
      crv: "P-256",
      x: punkt.subarray(1, 33).toString("base64url"),
      y: punkt.subarray(33).toString("base64url"),
    });
  });

  it("opens what the tablet encrypted with WebCrypto, for its own terminal only", async () => {
    const schluessel = ausweisSchluesselAus(geheim(7));
    for (const ausweis of [
      { pin: "471100" },
      { qr: "soll-ausweis:abc" },
      { karte: "04A1B2C3D4E5F6", pin: "471100" },
      { sun: { e: "EF963FF7828658A599F3041510671E88", c: "94EED9EE65337086" } },
    ]) {
      const klartext = JSON.stringify(ausweis);
      const chiffre = await ausweisVerschluesseln(
        crypto.subtle,
        schluessel.oeffentlich,
        klartext,
        TERMINAL,
      );
      expect(ausweisOeffnen(schluessel.privat, chiffre, TERMINAL)).toBe(klartext);
      expect(ausweisOeffnen(schluessel.privat, chiffre, "anderes-terminal")).toBeNull();
    }
  });

  it("opens nothing that was changed, cut short or meant for another server", async () => {
    const schluessel = ausweisSchluesselAus(geheim(7));
    const chiffre = await ausweisVerschluesseln(
      crypto.subtle,
      schluessel.oeffentlich,
      '{"pin":"471100"}',
      TERMINAL,
    );
    const bytes = Buffer.from(chiffre, "base64url");
    bytes[100] = (bytes[100] ?? 0) ^ 1;
    expect(ausweisOeffnen(schluessel.privat, bytes.toString("base64url"), TERMINAL)).toBeNull();
    expect(ausweisOeffnen(schluessel.privat, chiffre.slice(0, 40), TERMINAL)).toBeNull();
    expect(ausweisOeffnen(schluessel.privat, "kein base64!", TERMINAL)).toBeNull();
    expect(ausweisOeffnen(ausweisSchluesselAus(geheim(8)).privat, chiffre, TERMINAL)).toBeNull();
  });
});

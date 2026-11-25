import { describe, expect, it } from "vitest";
import {
  AUSWEIS_LAENGE,
  AUSWEIS_ZWECK,
  ausweisVerschluesseln,
  NONCE_BYTES,
  PUNKT_BYTES,
  terminalNachricht,
} from "./terminal.ts";

const eintrag = {
  terminalId: "0b7c2f1e-1d4f-4c7e-9a43-2c1f0e9b7d10",
  nummer: 7,
  art: "kommen" as const,
  geraetZeitpunkt: Date.parse("2026-11-20T07:58:00+01:00"),
  ausweis: "Zm9v",
};

describe("terminalNachricht (S-803)", () => {
  it("is a JSON array in a fixed order, whatever the order of the fields", () => {
    const umgekehrt = {
      ausweis: eintrag.ausweis,
      geraetZeitpunkt: eintrag.geraetZeitpunkt,
      art: eintrag.art,
      nummer: eintrag.nummer,
      terminalId: eintrag.terminalId,
    };
    expect(terminalNachricht(umgekehrt)).toBe(terminalNachricht(eintrag));
    expect(terminalNachricht(eintrag)).toBe(
      `["soll/terminal-stempel/1","${eintrag.terminalId}",7,"kommen",${eintrag.geraetZeitpunkt},"Zm9v"]`,
    );
  });

  it("differs in every field, so the signature covers the credential too", () => {
    const basis = terminalNachricht(eintrag);
    for (const anders of [
      { ...eintrag, terminalId: "anderes" },
      { ...eintrag, nummer: 8 },
      { ...eintrag, art: "gehen" as const },
      { ...eintrag, geraetZeitpunkt: eintrag.geraetZeitpunkt + 1 },
      { ...eintrag, ausweis: "Zm9w" },
    ])
      expect(terminalNachricht(anders)).not.toBe(basis);
  });
});

const bytesAus = (base64url: string) =>
  Uint8Array.from(atob(base64url.replaceAll("-", "+").replaceAll("_", "/")), (z) =>
    z.charCodeAt(0),
  );

/** The receiving side of the scheme with WebCrypto, to check it in itself (the server uses node:crypto) */
const oeffnen = async (privat: CryptoKey, chiffre: string, zusatz: string) => {
  const bytes = bytesAus(chiffre);
  const punkt = bytes.slice(0, PUNKT_BYTES);
  const nonce = bytes.slice(PUNKT_BYTES, PUNKT_BYTES + NONCE_BYTES);
  const kurve = { name: "ECDH", namedCurve: "P-256" } as const;
  const einmal = await crypto.subtle.importKey("raw", punkt, kurve, false, []);
  const geteilt = await crypto.subtle.deriveBits({ name: "ECDH", public: einmal }, privat, 256);
  const hkdf = await crypto.subtle.importKey("raw", geteilt, "HKDF", false, ["deriveKey"]);
  const schluessel = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: punkt, info: new TextEncoder().encode(AUSWEIS_ZWECK) },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const klar = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(zusatz) },
    schluessel,
    bytes.slice(PUNKT_BYTES + NONCE_BYTES),
  );
  return new TextDecoder().decode(klar);
};

const serverPaar = async () => {
  const paar = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", paar.publicKey);
  return {
    privat: paar.privateKey,
    oeffentlich: { kty: "EC", crv: "P-256", x: jwk.x ?? "", y: jwk.y ?? "" },
  };
};

describe("ausweisVerschluesseln (S-803)", () => {
  it("opens with the server's private key and the same terminal, padded to one length", async () => {
    const server = await serverPaar();
    const chiffre = await ausweisVerschluesseln(
      crypto.subtle,
      server.oeffentlich,
      '{"pin":"471100"}',
      "t1",
    );
    expect(await oeffnen(server.privat, chiffre, "t1")).toBe(
      '{"pin":"471100"}'.padEnd(AUSWEIS_LAENGE),
    );
    await expect(oeffnen(server.privat, chiffre, "t2")).rejects.toThrow();
  });

  it("is as long for a PIN of six digits as for a QR code, and new each time", async () => {
    const server = await serverPaar();
    const kurz = await ausweisVerschluesseln(
      crypto.subtle,
      server.oeffentlich,
      '{"pin":"4711"}',
      "t",
    );
    const lang = await ausweisVerschluesseln(
      crypto.subtle,
      server.oeffentlich,
      JSON.stringify({ qr: `soll-ausweis:${"x".repeat(150)}` }),
      "t",
    );
    const nochmal = await ausweisVerschluesseln(
      crypto.subtle,
      server.oeffentlich,
      '{"pin":"4711"}',
      "t",
    );
    expect(bytesAus(kurz).length).toBe(PUNKT_BYTES + NONCE_BYTES + AUSWEIS_LAENGE + 16);
    expect(bytesAus(lang).length).toBe(bytesAus(kurz).length);
    expect(nochmal).not.toBe(kurz);
    expect(kurz).not.toContain("4711");
  });
});

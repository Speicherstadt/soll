import {
  ausweisVerschluesseln,
  base64url,
  type Stempelart,
  terminalNachricht,
} from "@soll/arbeitszeit";
import { JETZT, json, type tablet } from "./terminal-testhilfen.ts";

type Geraet = ReturnType<typeof tablet> & { terminalId: string };
type Schluessel = { kty: string; crv: string; x: string; y: string };

/** The public key a tablet's key pair exports, as the kiosk registers it */
const oeffentlich = async (paar: CryptoKeyPair): Promise<Schluessel> => {
  const jwk = await crypto.subtle.exportKey("jwk", paar.publicKey);
  return { kty: "EC", crv: "P-256", x: jwk.x ?? "", y: jwk.y ?? "" };
};

export const neuesPaar = () =>
  crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);

/** Fields of an entry a test may set; the rest as the tablet would send them at JETZT */
export type Angaben = {
  nummer: number;
  ausweis: unknown;
  art?: Stempelart;
  geraetZeitpunkt?: number;
  gesendetAm?: number;
  /** the terminal the credential is encrypted for (another one in a test) */
  fuer?: string;
};

/**
 * A paired tablet with a key pair of its own and the server's key for credentials, as the kiosk
 * holds them (S-803): it registers its key, builds and signs entries and sends them
 */
export const offlineTablet = async (geraet: Geraet, paar?: CryptoKeyPair) => {
  const schluessel = paar ?? (await neuesPaar());
  const stand = await json(await geraet.anfrage("/api/v1/kiosk"));
  const server = stand.ausweisSchluessel as Schluessel;
  const eintrag = async (angaben: Angaben, signierer = schluessel) => {
    const geraetZeitpunkt = angaben.geraetZeitpunkt ?? JETZT - 60_000;
    const ohne = {
      terminalId: geraet.terminalId,
      nummer: angaben.nummer,
      art: angaben.art ?? "kommen",
      geraetZeitpunkt,
      ausweis: await ausweisVerschluesseln(
        crypto.subtle,
        server,
        JSON.stringify(angaben.ausweis),
        angaben.fuer ?? geraet.terminalId,
      ),
    };
    const signatur = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signierer.privateKey,
      new TextEncoder().encode(terminalNachricht(ohne)),
    );
    const { terminalId: _, ...body } = ohne;
    return {
      ...body,
      gesendetAm: angaben.gesendetAm ?? geraetZeitpunkt,
      signatur: base64url(new Uint8Array(signatur)),
    };
  };
  return {
    server,
    anmelden: async (andere?: CryptoKeyPair) =>
      geraet.anfrage("/api/v1/kiosk/schluessel", {
        method: "PUT",
        body: { schluessel: await oeffentlich(andere ?? schluessel) },
      }),
    eintrag,
    senden: (body: unknown) => geraet.anfrage("/api/v1/kiosk/offline", { body }),
    /** builds, signs and sends an entry */
    stempeln: async (angaben: Angaben) =>
      geraet.anfrage("/api/v1/kiosk/offline", { body: await eintrag(angaben) }),
  };
};

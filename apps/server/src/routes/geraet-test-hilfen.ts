import { type Offlineeintrag, type Stempelart, stempelNachricht } from "@soll/arbeitszeit";

/**
 * A device as the app makes it (apps/web/src/offline/schluessel.ts): a non-extractable ECDSA P-256
 * key pair from WebCrypto, its public key as JWK, and entries signed with it (S-305)
 */
export const testGeraet = async (geraetId: string = crypto.randomUUID()) => {
  const paar = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
    "verify",
  ]);
  const schluessel = await crypto.subtle.exportKey("jwk", paar.publicKey);
  const signieren = async (eintrag: Offlineeintrag) =>
    Buffer.from(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        paar.privateKey,
        new TextEncoder().encode(stempelNachricht(eintrag)),
      ),
    ).toString("base64url");
  /** The body of POST /stempelungen/offline for an entry */
  const offline = async (
    nummer: number,
    art: Stempelart,
    geraetZeitpunkt: number,
    gesendetAm: number,
  ) => ({
    art,
    geraetZeitpunkt,
    gesendetAm,
    geraet: {
      geraetId,
      nummer,
      signatur: await signieren({ geraetId, nummer, art, geraetZeitpunkt }),
    },
  });
  return { geraetId, schluessel, privat: paar.privateKey, signieren, offline };
};

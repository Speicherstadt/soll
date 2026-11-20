import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from "node:crypto";
import type { PushAnfrage } from "./webpush.ts";

/*
 * A stand-in for the push service and the browser behind it (CLAUDE.md: what the outside world
 * provides is replaced in tests), built from RFC 8030, 8291 and 8292: it checks the VAPID token,
 * decrypts the content with the subscription's private key and keeps what arrived.
 */

const hmac = (schluessel: Uint8Array, ...teile: Uint8Array[]) => {
  const h = createHmac("sha256", schluessel);
  for (const teil of teile) h.update(teil);
  return new Uint8Array(h.digest());
};
const text = (wert: string) => new Uint8Array(Buffer.from(wert, "latin1"));
const EINS = new Uint8Array([1]);

/** What the user agent does with a message (RFC 8291, Section 3.4, read backwards) */
export const pushEntschluesseln = (
  koerper: Uint8Array,
  uaPrivat: Uint8Array,
  auth: Uint8Array,
): Uint8Array => {
  const daten = Buffer.from(koerper);
  const salz = daten.subarray(0, 16);
  const laenge = daten.readUInt8(20);
  const asOeffentlich = daten.subarray(21, 21 + laenge);
  const ua = createECDH("prime256v1");
  ua.setPrivateKey(uaPrivat);
  const uaOeffentlich = new Uint8Array(ua.getPublicKey());
  const ecdh = new Uint8Array(ua.computeSecret(asOeffentlich));
  const ikm = hmac(hmac(auth, ecdh), text("WebPush: info\0"), uaOeffentlich, asOeffentlich, EINS);
  const prk = hmac(salz, ikm);
  const cek = hmac(prk, text("Content-Encoding: aes128gcm\0"), EINS).subarray(0, 16);
  const nonce = hmac(prk, text("Content-Encoding: nonce\0"), EINS).subarray(0, 12);
  const inhalt = daten.subarray(21 + laenge);
  const entschluessler = createDecipheriv("aes-128-gcm", cek, nonce);
  entschluessler.setAuthTag(inhalt.subarray(inhalt.length - 16));
  const klar = Buffer.concat([
    entschluessler.update(inhalt.subarray(0, inhalt.length - 16)),
    entschluessler.final(),
  ]);
  if (klar.at(-1) !== 2) throw new Error("padding delimiter missing");
  return new Uint8Array(klar.subarray(0, -1));
};

type Claims = { aud: string; exp: number; sub: string };

/** Checks `vapid t=…, k=…` against the server's public key, as a push service does */
export const vapidPruefen = (
  kopf: string,
  oeffentlich: string,
): { ok: true; claims: Claims } | { ok: false } => {
  const treffer = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(kopf);
  if (!treffer || treffer[4] !== oeffentlich) return { ok: false };
  const [, jwtKopf = "", claims = "", signatur = ""] = treffer;
  const punkt = Buffer.from(oeffentlich, "base64url");
  const schluessel = createPublicKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: punkt.subarray(1, 33).toString("base64url"),
      y: punkt.subarray(33, 65).toString("base64url"),
    },
  });
  const echt = verify(
    "sha256",
    Buffer.from(`${jwtKopf}.${claims}`),
    { key: schluessel, dsaEncoding: "ieee-p1363" },
    Buffer.from(signatur, "base64url"),
  );
  if (!echt) return { ok: false };
  return { ok: true, claims: JSON.parse(Buffer.from(claims, "base64url").toString()) as Claims };
};

/** A browser's subscription: its key pair and auth secret, and the JSON it gives the server */
export const testAbo = (endpoint: string) => {
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const auth = new Uint8Array(16).map((_, i) => i * 7 + 1);
  return {
    privat: new Uint8Array(ua.getPrivateKey()),
    auth,
    json: {
      endpoint,
      keys: {
        p256dh: Buffer.from(ua.getPublicKey()).toString("base64url"),
        auth: Buffer.from(auth).toString("base64url"),
      },
    },
  };
};

export type Zugestellt = { endpoint: string; inhalt: unknown; ttl: number };

/**
 * The push service: answers each endpoint as configured (201 by default, 410 for a subscription that
 * is gone), refuses a bad token with 403 and keeps what it delivered, decrypted for the device
 */
export const pushDienstErsatz = (
  oeffentlich: () => string,
  geraete: Map<string, ReturnType<typeof testAbo>>,
  antworten: Map<string, number> = new Map(),
) => {
  const zugestellt: Zugestellt[] = [];
  const senden = async (anfrage: PushAnfrage): Promise<{ status: number }> => {
    const pruefung = vapidPruefen(anfrage.headers.authorization ?? "", oeffentlich());
    // RFC 8292, Section 2.1: the contact is a mailto: or https: URI; Apple and Mozilla refuse others
    if (!pruefung.ok || !/^(mailto:|https:)/.test(pruefung.claims.sub)) return { status: 403 };
    const status = antworten.get(anfrage.url) ?? 201;
    const geraet = geraete.get(anfrage.url);
    if (status !== 201 || !geraet) return { status: geraet ? status : 404 };
    const klar = pushEntschluesseln(anfrage.body, geraet.privat, geraet.auth);
    zugestellt.push({
      endpoint: anfrage.url,
      inhalt: JSON.parse(Buffer.from(klar).toString("utf8")),
      ttl: Number(anfrage.headers.ttl),
    });
    return { status: 201 };
  };
  return { senden, zugestellt };
};

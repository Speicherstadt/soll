import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from "node:crypto";

/*
 * Web Push without a library: the message to a push service (RFC 8030), its content encrypted for
 * the subscription (RFC 8291 with the aes128gcm coding of RFC 8188) and the server named by VAPID
 * (RFC 8292). node:crypto runs the same under Bun and in `bun build --compile`.
 */

/** A P-256 key pair in base64url: the public key uncompressed (65 bytes), the private key d (32) */
export type VapidPaar = { oeffentlich: string; privat: string };

/** A subscription as PushSubscription.toJSON() gives it: endpoint, p256dh and auth in base64url */
export type Abo = { endpoint: string; p256dh: string; auth: string };

const KURVE = "prime256v1";
/** RFC 8188: one record; the content plus delimiter and tag must fit (RFC 8291, Section 4) */
const DATENSATZ = 4096;
const TAG = 16;
/** RFC 8292, Section 2: at most 24 hours; 12 leave room for a clock that runs ahead */
const GUELTIG_S = 12 * 3600;
/** How long the push service keeps a message for a device that is offline (RFC 8030, 5.2) */
const TTL_S = 12 * 3600;

const roh = (text: string) => new Uint8Array(Buffer.from(text, "base64url"));
const b64 = (daten: Uint8Array | string) => Buffer.from(daten).toString("base64url");
const hmac = (schluessel: Uint8Array, ...teile: Uint8Array[]) => {
  const h = createHmac("sha256", schluessel);
  for (const teil of teile) h.update(teil);
  return new Uint8Array(h.digest());
};
const text = (wert: string) => new Uint8Array(Buffer.from(wert, "latin1"));
const EINS = new Uint8Array([1]);

export const schluesselPaar = (): VapidPaar => {
  const ecdh = createECDH(KURVE);
  ecdh.generateKeys();
  return { oeffentlich: b64(ecdh.getPublicKey()), privat: b64(ecdh.getPrivateKey()) };
};

/** Whether a key is an uncompressed point on P-256 (RFC 8291, Section 7: check before use) */
export const gueltigerPunkt = (oeffentlich: Uint8Array): boolean => {
  if (oeffentlich.length !== 65 || oeffentlich[0] !== 4) return false;
  try {
    const probe = createECDH(KURVE);
    probe.generateKeys();
    probe.computeSecret(oeffentlich);
    return true;
  } catch {
    return false;
  }
};

/**
 * The body of a push message, encrypted for the user agent (RFC 8291, Section 3.4): the key and salt
 * are fresh for every message; tests pass the ones of RFC 8291, Appendix A
 */
export const verschluesseln = (eingabe: {
  klartext: Uint8Array;
  uaOeffentlich: Uint8Array;
  auth: Uint8Array;
  asPrivat?: Uint8Array;
  salz?: Uint8Array;
}): Uint8Array => {
  if (eingabe.klartext.length + 1 + TAG > DATENSATZ) throw new Error("push content too long");
  const as = createECDH(KURVE);
  if (eingabe.asPrivat) as.setPrivateKey(eingabe.asPrivat);
  else as.generateKeys();
  const asOeffentlich = new Uint8Array(as.getPublicKey());
  const salz = eingabe.salz ?? new Uint8Array(randomBytes(16));
  const ecdh = new Uint8Array(as.computeSecret(eingabe.uaOeffentlich));
  const prkSchluessel = hmac(eingabe.auth, ecdh);
  const ikm = hmac(
    prkSchluessel,
    text("WebPush: info\0"),
    eingabe.uaOeffentlich,
    asOeffentlich,
    EINS,
  );
  const prk = hmac(salz, ikm);
  const cek = hmac(prk, text("Content-Encoding: aes128gcm\0"), EINS).subarray(0, 16);
  const nonce = hmac(prk, text("Content-Encoding: nonce\0"), EINS).subarray(0, 12);
  const chiffre = createCipheriv("aes-128-gcm", cek, nonce);
  const inhalt = Buffer.concat([
    chiffre.update(Buffer.concat([eingabe.klartext, new Uint8Array([2])])),
    chiffre.final(),
    chiffre.getAuthTag(),
  ]);
  const kopf = Buffer.alloc(21);
  Buffer.from(salz).copy(kopf, 0);
  kopf.writeUInt32BE(DATENSATZ, 16);
  kopf.writeUInt8(asOeffentlich.length, 20);
  return new Uint8Array(Buffer.concat([kopf, asOeffentlich, inhalt]));
};

/** The private key as a KeyObject: JWK needs x and y, which follow from d */
const privaterSchluessel = (paar: VapidPaar) => {
  const oeffentlich = roh(paar.oeffentlich);
  return createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: paar.privat,
      x: b64(oeffentlich.subarray(1, 33)),
      y: b64(oeffentlich.subarray(33, 65)),
    },
  });
};

/** For an instance on http without mail; `.invalid` is reserved and reaches nobody (RFC 2606) */
export const KONTAKT_ERSATZ = "mailto:push@soll.invalid";

/**
 * The VAPID contact (`sub`): a mailto: or https: URI (RFC 8292, Section 2.1), as Apple's and
 * Mozilla's push services refuse other forms. The sender of the instance's mail, else its URL if
 * that is https, else a fixed placeholder; never an http: URI.
 */
export const vapidKontakt = (url: string, mailVon: string | undefined): string => {
  const adresse = mailVon?.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ?? mailVon?.trim();
  if (adresse && /^[^<>\s@]+@[^<>\s@]+$/.test(adresse)) return `mailto:${adresse}`;
  return url.startsWith("https://") ? url : KONTAKT_ERSATZ;
};

/** `Authorization: vapid t=<JWT>, k=<public key>` (RFC 8292, Sections 2 and 3) */
export const vapidKopf = (
  endpoint: string,
  paar: VapidPaar,
  kontakt: string,
  jetzt: number,
): string => {
  const kopf = b64(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(jetzt / 1000) + GUELTIG_S,
      sub: kontakt,
    }),
  );
  const signatur = sign("sha256", Buffer.from(`${kopf}.${claims}`), {
    key: privaterSchluessel(paar),
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${kopf}.${claims}.${b64(signatur)}, k=${paar.oeffentlich}`;
};

export type PushAnfrage = { url: string; headers: Record<string, string>; body: Uint8Array };

/** The POST to the subscription's endpoint (RFC 8030, Section 5) */
export const pushAnfrage = (eingabe: {
  abo: Abo;
  inhalt: string;
  vapid: VapidPaar;
  kontakt: string;
  jetzt: number;
}): PushAnfrage => ({
  url: eingabe.abo.endpoint,
  headers: {
    authorization: vapidKopf(eingabe.abo.endpoint, eingabe.vapid, eingabe.kontakt, eingabe.jetzt),
    "content-encoding": "aes128gcm",
    "content-type": "application/octet-stream",
    ttl: String(TTL_S),
    urgency: "high",
  },
  body: verschluesseln({
    klartext: new Uint8Array(Buffer.from(eingabe.inhalt, "utf8")),
    uaOeffentlich: roh(eingabe.abo.p256dh),
    auth: roh(eingabe.abo.auth),
  }),
});

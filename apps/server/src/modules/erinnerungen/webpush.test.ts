import { createECDH } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pushEntschluesseln, vapidPruefen } from "./push-test.ts";
import { pushAnfrage, schluesselPaar, vapidKontakt, verschluesseln } from "./webpush.ts";

const b64 = (text: string) => new Uint8Array(Buffer.from(text.replace(/\s+/g, ""), "base64url"));

// RFC 8291, Section 5 and Appendix A
const RFC = {
  klartext: b64("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24"),
  asPrivat: b64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
  uaOeffentlich: b64(
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  ),
  uaPrivat: b64("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94"),
  salz: b64("DGv6ra1nlYgDCS1FRnbzlw"),
  auth: b64("BTBZMqHH6r4Tts7J_aSIgg"),
  ergebnis: `DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml
    mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT
    pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN`,
};

describe("Web Push encryption (RFC 8291, aes128gcm)", () => {
  it("produces the message of RFC 8291, Section 5, from its keys and salt", () => {
    const koerper = verschluesseln({
      klartext: RFC.klartext,
      uaOeffentlich: RFC.uaOeffentlich,
      auth: RFC.auth,
      asPrivat: RFC.asPrivat,
      salz: RFC.salz,
    });
    expect(Buffer.from(koerper).toString("base64url")).toBe(RFC.ergebnis.replace(/\s+/g, ""));
  });

  it("is read back by the user agent's private key, with a fresh key and salt each time", () => {
    const erstes = verschluesseln({
      klartext: RFC.klartext,
      uaOeffentlich: RFC.uaOeffentlich,
      auth: RFC.auth,
    });
    const zweites = verschluesseln({
      klartext: RFC.klartext,
      uaOeffentlich: RFC.uaOeffentlich,
      auth: RFC.auth,
    });
    expect(Buffer.from(erstes).equals(Buffer.from(zweites))).toBe(false);
    const gelesen = pushEntschluesseln(erstes, RFC.uaPrivat, RFC.auth);
    expect(Buffer.from(gelesen).toString("utf8")).toBe("When I grow up, I want to be a watermelon");
  });
});

describe("VAPID (RFC 8292)", () => {
  const vapid = schluesselPaar();
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const abo = {
    endpoint: "https://push.example.test/abo/123",
    p256dh: Buffer.from(ua.getPublicKey()).toString("base64url"),
    auth: Buffer.from(RFC.auth).toString("base64url"),
  };
  const jetzt = 1_790_000_000_000;

  it("signs a JWT for the origin of the endpoint that the public key verifies, valid 12 hours", () => {
    const anfrage = pushAnfrage({
      abo,
      inhalt: "{}",
      vapid,
      kontakt: "https://soll.example.test",
      jetzt,
    });
    expect(anfrage.url).toBe(abo.endpoint);
    expect(anfrage.headers["content-encoding"]).toBe("aes128gcm");
    expect(Number(anfrage.headers.ttl)).toBeGreaterThan(0);
    const pruefung = vapidPruefen(anfrage.headers.authorization ?? "", vapid.oeffentlich);
    expect(pruefung).toEqual({
      ok: true,
      claims: {
        aud: "https://push.example.test",
        exp: jetzt / 1000 + 12 * 3600,
        sub: "https://soll.example.test",
      },
    });
  });

  it("is refused for another key", () => {
    const anfrage = pushAnfrage({
      abo,
      inhalt: "{}",
      vapid,
      kontakt: "https://soll.example.test",
      jetzt,
    });
    expect(vapidPruefen(anfrage.headers.authorization ?? "", schluesselPaar().oeffentlich).ok).toBe(
      false,
    );
  });

  it("carries the content encrypted for the subscription", () => {
    const anfrage = pushAnfrage({
      abo,
      inhalt: '{"art":"monat"}',
      vapid,
      kontakt: "https://soll.example.test",
      jetzt,
    });
    expect(Buffer.from(anfrage.body).toString("utf8")).not.toContain("monat");
    const gelesen = pushEntschluesseln(anfrage.body, new Uint8Array(ua.getPrivateKey()), RFC.auth);
    expect(Buffer.from(gelesen).toString("utf8")).toBe('{"art":"monat"}');
  });
});

describe("VAPID contact (RFC 8292, Section 2.1: mailto: or https:)", () => {
  it("is the sender's address when the instance sends mail", () => {
    expect(vapidKontakt("http://soll.lan", "Soll <soll@weber-haustechnik.test>")).toBe(
      "mailto:soll@weber-haustechnik.test",
    );
    expect(vapidKontakt("https://soll.weber.test", "zeit@weber-haustechnik.test")).toBe(
      "mailto:zeit@weber-haustechnik.test",
    );
  });

  it("is the instance's URL only when it is https", () => {
    expect(vapidKontakt("https://soll.weber.test", undefined)).toBe("https://soll.weber.test");
  });

  it("is a fixed mailto: for an http instance without mail, never an http: URI", () => {
    for (const url of ["http://soll.lan", "http://localhost:8200"]) {
      expect(vapidKontakt(url, undefined)).toBe("mailto:push@soll.invalid");
    }
  });
});

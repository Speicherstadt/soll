import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { adresseOeffentlich, erlaubteUrspruenge, instanzVon } from "./kimai-adresse.ts";

/*
 * Which addresses the server may call for a Kimai the owner names (BAULISTE.md S-705); the ranges
 * after the IANA IPv4 and IPv6 special-purpose address registries (RFC 6890).
 */

describe("adresseOeffentlich", () => {
  it.each([
    "127.0.0.1",
    "127.255.0.9",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.178.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "198.18.0.1",
    "192.0.2.5",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a9fe:a9fe",
    "2001:db8::1",
    "2002:c0a8:101::1",
    "2001::1",
    "fe80::1%eth0",
    "kimai.weber.test",
    "",
  ])("refuses %s", (ip) => {
    expect(adresseOeffentlich(ip)).toBe(false);
  });

  it.each([
    "93.184.215.14",
    "1.1.1.1",
    "172.32.0.1",
    "100.128.0.1",
    "2a00:1450:4001:80b::200e",
    "::ffff:93.184.215.14",
    "64:ff9b::5db8:d70e",
  ])("takes %s", (ip) => {
    expect(adresseOeffentlich(ip)).toBe(true);
  });

  it("never throws, on any text", () => {
    fc.assert(fc.property(fc.string(), (text) => typeof adresseOeffentlich(text) === "boolean"));
  });
});

describe("instanzVon", () => {
  const keine = new Set<string>();

  it("takes https with a path and drops a trailing /api", () => {
    expect(instanzVon("https://zeit.weber.test/kimai/api/", keine)).toEqual({
      basis: "https://zeit.weber.test/kimai",
      nurOeffentlich: true,
    });
  });

  it.each([
    "http://zeit.weber.test",
    "https://jonas:geheim@zeit.weber.test",
    "https://zeit.weber.test/?x=1",
    "https://zeit.weber.test/#a",
    "https://127.0.0.1",
    "https://[::1]:8443",
    "https://169.254.169.254/latest",
    "ftp://zeit.weber.test",
    "file:///etc/passwd",
    "zeit.weber.test",
    "",
  ])("refuses %s", (text) => {
    expect(instanzVon(text, keine)).toBeNull();
  });

  it("lets an origin the operator allows be http and private", () => {
    const erlaubt = erlaubteUrspruenge(" http://127.0.0.1:28213 , kaputt, https://kimai.lan ");
    expect(erlaubt).toEqual(new Set(["http://127.0.0.1:28213", "https://kimai.lan"]));
    expect(instanzVon("http://127.0.0.1:28213/", erlaubt)).toEqual({
      basis: "http://127.0.0.1:28213",
      nurOeffentlich: false,
    });
    expect(instanzVon("http://127.0.0.1:28214/", erlaubt)).toBeNull();
  });
});

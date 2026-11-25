import { isIP } from "node:net";

/*
 * The address of a Kimai instance, which the owner types in (BAULISTE.md S-705): the server would
 * call any address it is given, so it calls only public ones over https (protection against
 * server-side request forgery, OWASP SSRF Prevention Cheat Sheet). The ranges that are not public
 * follow the IANA special-purpose registries for IPv4 (RFC 6890 and its updates) and IPv6; an
 * IPv6 address is public only inside 2000::/3 (RFC 4291) and outside the special ranges there.
 * An origin the operator of the instance lists in SOLL_IMPORT_ALLOWED_ORIGINS (a Kimai in the
 * business's own network, the stand-in of the tests) may be http and private.
 */

/** IPv4 ranges that are not public: [first address as a number, prefix length] */
const V4_INTERN: readonly [string, number][] = [
  ["0.0.0.0", 8], // this network
  ["10.0.0.0", 8], // private (RFC 1918)
  ["100.64.0.0", 10], // shared address space, carrier-grade NAT (RFC 6598)
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, also cloud metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved and broadcast
];

const v4Zahl = (ip: string): number =>
  ip.split(".").reduce((zahl, teil) => zahl * 256 + Number(teil), 0);

const inNetz = (zahl: number, [netz, laenge]: [string, number]): boolean => {
  const groesse = 2 ** (32 - laenge);
  return Math.floor(zahl / groesse) === Math.floor(v4Zahl(netz) / groesse);
};

const v4Oeffentlich = (ip: string): boolean => !V4_INTERN.some((netz) => inNetz(v4Zahl(ip), netz));

/** The eight 16-bit groups of an IPv6 address (with "::" and an IPv4 tail), or null */
const v6Gruppen = (ip: string): number[] | null => {
  const ohneZone = ip.split("%")[0] ?? "";
  const vierer = /(\d+\.\d+\.\d+\.\d+)$/.exec(ohneZone);
  const text = vierer
    ? ohneZone.replace(
        vierer[1] as string,
        ((z) => `${(z >>> 16).toString(16)}:${(z & 0xffff).toString(16)}`)(
          v4Zahl(vierer[1] as string),
        ),
      )
    : ohneZone;
  const [vorne, hinten, zuviel] = text.split("::");
  if (zuviel !== undefined) return null;
  const teile = (s: string | undefined) => (s ? s.split(":") : []);
  const links = teile(vorne);
  const rechts = teile(hinten);
  const fehlen = 8 - links.length - rechts.length;
  if (hinten === undefined ? fehlen !== 0 : fehlen < 1) return null;
  const gruppen = [...links, ...Array(hinten === undefined ? 0 : fehlen).fill("0"), ...rechts];
  return gruppen.every((g) => /^[0-9a-f]{1,4}$/i.test(g))
    ? gruppen.map((g) => Number.parseInt(g, 16))
    : null;
};

const v4Aus = (hoch: number, tief: number): string =>
  [hoch >> 8, hoch & 0xff, tief >> 8, tief & 0xff].join(".");

const v6Oeffentlich = (ip: string): boolean => {
  const g = v6Gruppen(ip);
  if (g === null) return false;
  const [a = 0, b = 0, , , , f = 0, x = 0, y = 0] = g;
  // IPv4-mapped (::ffff:0:0/96) and NAT64 (64:ff9b::/96): as public as the IPv4 address inside
  if (g.slice(0, 5).every((n) => n === 0) && f === 0xffff) return v4Oeffentlich(v4Aus(x, y));
  if (a === 0x64 && b === 0xff9b && g.slice(2, 6).every((n) => n === 0))
    return v4Oeffentlich(v4Aus(x, y));
  if ((a & 0xe000) !== 0x2000) return false; // outside global unicast 2000::/3
  if (a === 0x2001 && b < 0x200) return false; // 2001::/23 IETF protocol assignments (Teredo …)
  if (a === 0x2001 && b === 0xdb8) return false; // documentation
  if (a === 0x2002) return false; // 6to4
  return !(a === 0x3fff && b < 0x1000); // documentation 3fff::/20
};

/** Whether the server may connect to an address: a public IPv4 or IPv6 address */
export const adresseOeffentlich = (ip: string): boolean => {
  const art = isIP(ip);
  if (art === 4) return v4Oeffentlich(ip);
  if (art === 6) return v6Oeffentlich(ip);
  return false;
};

/** Where the API of an instance is, and whether its addresses must be public */
export type Instanz = { basis: string; nurOeffentlich: boolean };

/**
 * The instance from what the owner typed: https (or an allowed origin), no user and password in
 * it, no query or fragment; its path is kept, as Kimai may live below one ("/kimai"). Null when
 * it may not be called.
 */
export const instanzVon = (text: string, erlaubt: ReadonlySet<string>): Instanz | null => {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash || !url.hostname) return null;
  const frei = erlaubt.has(url.origin);
  if (!frei && url.protocol !== "https:") return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!frei && isIP(host) !== 0 && !adresseOeffentlich(host)) return null;
  const pfad = url.pathname.replace(/\/+$/, "").replace(/\/api$/, "");
  return { basis: `${url.origin}${pfad}`, nurOeffentlich: !frei };
};

/** The allowed origins from the environment: a comma-separated list of URLs */
export const erlaubteUrspruenge = (text: string | undefined): Set<string> =>
  new Set(
    (text ?? "")
      .split(",")
      .map((teil) => teil.trim())
      .filter((teil) => teil !== "")
      .flatMap((teil) => {
        try {
          return [new URL(teil).origin];
        } catch {
          return [];
        }
      }),
  );

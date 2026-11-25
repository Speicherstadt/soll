import { lookup } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { adresseOeffentlich } from "./kimai-adresse.ts";

/*
 * One GET to an address the owner typed (BAULISTE.md S-705), guarded against server-side request
 * forgery: every address the name resolves to is checked when the connection is made, inside the
 * `lookup` of node:https, so a second answer of the DNS (rebinding) cannot slip past a check made
 * before; a redirect is an error and never followed (the token goes nowhere else); 30 s and 10 MiB
 * at most. Not `fetch`: it resolves the name itself and offers no hook between DNS and connect.
 */

export const ZEITLIMIT_MS = 30_000;
export const MAX_ANTWORT = 10 * 1024 * 1024;

export type Antwort = { status: number; kopf: (name: string) => string | null; text: string };
export type VerbindungsFehler =
  | "adresse_intern"
  | "nicht_erreichbar"
  | "weiterleitung"
  | "zu_gross";
export type Abgerufen = { ok: true; wert: Antwort } | { ok: false; grund: VerbindungsFehler };

/** A GET: the URL, its headers, and whether the addresses it reaches must be public */
export type Holen = (
  url: URL,
  kopf: Record<string, string>,
  nurOeffentlich: boolean,
) => Promise<Abgerufen>;

export type Adresse = { address: string; family: number };
export type Aufloesen = (host: string) => Promise<Adresse[]>;

export const dnsAufloesen: Aufloesen = (host) =>
  new Promise((fertig, fehler) =>
    lookup(host, { all: true }, (err, adressen) => (err ? fehler(err) : fertig(adressen))),
  );

/** The code of the error a lookup gives for an address that is not public */
const INTERN = "SOLL_ADDRESS_NOT_PUBLIC";

/** A lookup that answers only when every address of the name is public */
const gepruefteSuche =
  (aufloesen: Aufloesen, nurOeffentlich: boolean): LookupFunction =>
  (host, optionen, antworten) => {
    aufloesen(host).then(
      (adressen) => {
        const erste = adressen[0];
        if (!erste) return antworten(new Error("no address"), "", 4);
        if (nurOeffentlich && !adressen.every((a) => adresseOeffentlich(a.address)))
          return antworten(Object.assign(new Error(INTERN), { code: INTERN }), "", 4);
        if (optionen.all)
          return (antworten as unknown as (e: null, a: Adresse[]) => void)(null, adressen);
        return antworten(null, erste.address, erste.family);
      },
      (err: Error) => antworten(err, "", 4),
    );
  };

/** Reads a response up to MAX_ANTWORT; a redirect is refused unread */
const lesen = (antwort: IncomingMessage, fertig: (ergebnis: Abgerufen) => void) => {
  const status = antwort.statusCode ?? 0;
  if (status >= 300 && status < 400) {
    antwort.destroy();
    return fertig({ ok: false, grund: "weiterleitung" });
  }
  const teile: Buffer[] = [];
  let laenge = 0;
  antwort.on("data", (teil: Buffer) => {
    laenge += teil.length;
    if (laenge <= MAX_ANTWORT) teile.push(teil);
    else {
      antwort.destroy();
      fertig({ ok: false, grund: "zu_gross" });
    }
  });
  antwort.on("error", () => fertig({ ok: false, grund: "nicht_erreichbar" }));
  antwort.on("end", () =>
    fertig({
      ok: true,
      wert: {
        status,
        kopf: (name) => {
          const wert = antwort.headers[name.toLowerCase()];
          return typeof wert === "string" ? wert : null;
        },
        text: Buffer.concat(teile).toString("utf8"),
      },
    }),
  );
};

/**
 * A connection that checks every address with `aufloesen` (the DNS; a stand-in in tests); `ca`
 * only for the certificate of a test server
 */
export const sicherHolen =
  (aufloesen: Aufloesen = dnsAufloesen, ca?: string): Holen =>
  (url, kopf, nurOeffentlich) =>
    new Promise((aufloesenMit) => {
      let uhr: ReturnType<typeof setTimeout> | undefined;
      let erledigt = false;
      const fertig = (ergebnis: Abgerufen) => {
        if (erledigt) return;
        erledigt = true;
        clearTimeout(uhr);
        aufloesenMit(ergebnis);
      };
      const host = url.hostname.replace(/^\[|\]$/g, "");
      // an address typed as such is not looked up; it is checked here
      if (nurOeffentlich && isIP(host) !== 0 && !adresseOeffentlich(host))
        return fertig({ ok: false, grund: "adresse_intern" });
      // a header value node:http refuses throws here, not as an "error" event (kimai-abruf.ts checks
      // the access before); the value itself is never echoed
      let anfrage: ReturnType<typeof http.request>;
      try {
        anfrage = (url.protocol === "https:" ? https : http).request(
          {
            protocol: url.protocol,
            hostname: host,
            port: url.port || undefined,
            path: `${url.pathname}${url.search}`,
            method: "GET",
            headers: kopf,
            lookup: gepruefteSuche(aufloesen, nurOeffentlich),
            agent: false,
            ...(ca ? { ca } : {}),
          },
          (antwort) => lesen(antwort, fertig),
        );
      } catch {
        return fertig({ ok: false, grund: "nicht_erreichbar" });
      }
      uhr = setTimeout(() => {
        anfrage.destroy();
        fertig({ ok: false, grund: "nicht_erreichbar" });
      }, ZEITLIMIT_MS);
      anfrage.on("error", (err: Error & { code?: string }) =>
        fertig({
          ok: false,
          grund:
            err.code === INTERN || err.message === INTERN ? "adresse_intern" : "nicht_erreichbar",
        }),
      );
      anfrage.end();
    });

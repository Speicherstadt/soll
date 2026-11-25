import { dirname, join } from "node:path";
import { createApp } from "./app.ts";
import { createAuth } from "./auth/auth.ts";
import { testDatenbank } from "./db/test-db.ts";
import { ersatzHolen } from "./kimai-ersatz.ts";
import type { Schichtquelle } from "./modules/arbeitszeit/index.ts";
import { type PushSenden, vapidKontakt, vapidLaden } from "./modules/erinnerungen/index.ts";
import type { Mailer } from "./modules/mail/index.ts";
import { dateispeicher } from "./modules/umzug/index.ts";

export const TEST_URL = "http://localhost:28200";

type Optionen = {
  log?: (line: string) => void;
  uhr?: () => number;
  mail?: Mailer | null;
  schichten?: Schichtquelle;
  webVerzeichnis?: string | null;
  /** The stand-in for Haben the server calls (S-606) */
  habenFetch?: typeof fetch;
  /** The stand-in for Clockodo's API an import fetches from (S-703) */
  clockodoFetch?: (anfrage: Request) => Promise<Response>;
  /** The stand-in for the push service of messages about the plan (S-503) */
  push?: PushSenden;
  /** The stand-in for a Kimai instance an import fetches from (S-705) */
  kimaiFetch?: (anfrage: Request) => Promise<Response> | Response;
  /** The stand-in for Personio's API an import fetches from (S-704) */
  personioFetch?: (anfrage: Request) => Promise<Response> | Response;
  /** The stand-ins for Papershift, Planday and Crewmeister, by the host asked (S-706) */
  schichtplanerFetch?: (anfrage: Request) => Promise<Response> | Response;
};

/**
 * Passwords in tests: SHA-256 instead of scrypt, which takes tens of milliseconds per account and
 * made the server tests run into their 5 s timeouts on a busy runner. Only for test databases.
 */
const testKennwort = {
  hash: async (kennwort: string) =>
    Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(kennwort))).toString(
      "hex",
    ),
  verify: async ({ hash, password }: { hash: string; password: string }) =>
    hash === (await testKennwort.hash(password)),
};

/** The app on a fresh test database, with its own key and the VAPID pair made on its first start */
const testApp = (optionen: Optionen, jetzt: () => number) => {
  const datenbank = testDatenbank();
  const geheimerSchluessel = crypto.getRandomValues(new Uint8Array(32));
  const vapid = vapidLaden(datenbank.db, datenbank.schreibDb, geheimerSchluessel, 0);
  const auth = createAuth({
    db: datenbank.db,
    schreibDb: datenbank.schreibDb,
    geheimerSchluessel,
    url: TEST_URL,
    jetzt,
    kennwort: testKennwort,
  });
  const app = createApp({
    log: optionen.log ?? (() => undefined),
    now: jetzt,
    version: "test",
    db: datenbank.db,
    schreibDb: datenbank.schreibDb,
    auth,
    url: TEST_URL,
    mail: optionen.mail ?? null,
    ...(optionen.schichten ? { schichten: optionen.schichten } : {}),
    geheimerSchluessel,
    vapidOeffentlich: vapid.oeffentlich,
    webVerzeichnis: optionen.webVerzeichnis ?? null,
    ...(optionen.habenFetch ? { habenFetch: optionen.habenFetch } : {}),
    // never the network: without a stand-in, a fetch from Clockodo finds nothing there
    clockodo: {
      fetch: (url, init) =>
        optionen.clockodoFetch
          ? optionen.clockodoFetch(new Request(url, init))
          : Promise.reject(new TypeError("no network in tests")),
      basis: "https://clockodo.test/api",
    },
    push: optionen.push
      ? { vapid, kontakt: vapidKontakt(TEST_URL, undefined), senden: optionen.push }
      : null,
    dateien: dateispeicher(() => join(dirname(datenbank.pfad), "dateien")),
    // never the network: without a stand-in, no Kimai answers
    kimai: {
      holen: ersatzHolen(
        optionen.kimaiFetch ?? (() => Promise.reject(new TypeError("no network in tests"))),
      ),
      erlaubt: new Set(),
    },
    // never the network: without a stand-in, Personio does not answer
    personio: {
      holen: ersatzHolen(
        optionen.personioFetch ?? (() => Promise.reject(new TypeError("no network in tests"))),
      ),
      basis: "https://personio.test",
    },
    // never the network: without the stand-ins, no shift planner answers
    schichtplaner: {
      holen: ersatzHolen(
        optionen.schichtplanerFetch ?? (() => Promise.reject(new TypeError("no network in tests"))),
      ),
      adressen: {
        papershift: "https://papershift.test/public_api/v1",
        planday: "https://planday.test",
        plandayId: "https://id.planday.test",
        crewmeister: "https://crewmeister.test",
      },
    },
  });
  return { datenbank, geheimerSchluessel, vapid, auth, app };
};

/**
 * A server on a fresh test database with Better Auth, and helpers to act as people over HTTP, as a
 * browser would (cookies between calls)
 */
export const testServer = (optionen: Optionen = {}) => {
  let uhr = 1_790_000_000_000;
  const jetzt = optionen.uhr ?? (() => uhr);
  const { datenbank, geheimerSchluessel, vapid, auth, app } = testApp(optionen, jetzt);

  /** A browser of one person: keeps its cookies */
  const browser = () => {
    let cookie = "";
    const anfrage = async (pfad: string, init: { method?: string; body?: unknown } = {}) => {
      const antwort = await app.request(`${TEST_URL}${pfad}`, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers: {
          "content-type": "application/json",
          origin: TEST_URL,
          ...(cookie ? { cookie } : {}),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
      const gesetzt = antwort.headers.getSetCookie();
      if (gesetzt.length > 0) cookie = gesetzt.map((zeile) => zeile.split(";")[0]).join("; ");
      return antwort;
    };
    return { anfrage };
  };

  /** An owner with an account and a business of their own, signed in with it active */
  const inhaberMitBetrieb = async (name: string, slug: string) => {
    const b = browser();
    const email = `${slug}@betrieb.test`;
    const konto = await b.anfrage("/api/auth/sign-up/email", {
      body: { email, password: "geheim-geheim-123", name: `Inhaber ${name}` },
    });
    if (!konto.ok) throw new Error(`sign-up ${konto.status}: ${await konto.text()}`);
    const org = await b.anfrage("/api/auth/organization/create", { body: { name, slug } });
    if (!org.ok) throw new Error(`organization ${org.status}: ${await org.text()}`);
    const { id } = (await org.json()) as { id: string };
    const aktiv = await b.anfrage("/api/auth/organization/set-active", {
      body: { organizationId: id },
    });
    if (!aktiv.ok) throw new Error(`set-active ${aktiv.status}`);
    return {
      ...b,
      betriebId: id,
      nutzerId: (
        (await (await b.anfrage("/api/auth/get-session")).json()) as { user: { id: string } }
      ).user.id,
    };
  };

  type Person = Awaited<ReturnType<typeof inhaberMitBetrieb>>;

  /** Invites someone into the owner's business, lets them accept and sign in with a username */
  const eingeladen = async (inhaber: Person, rolle: string, benutzername: string) => {
    const einladung = (await (
      await inhaber.anfrage("/api/v1/einladungen", { body: { rolle, name: benutzername } })
    ).json()) as { link: string };
    const token = einladung.link.split("/einladung/")[1] ?? "";
    const b = browser();
    const passwort = "lange-genug-123";
    const angenommen = await b.anfrage(`/api/v1/einladung/${token}/annehmen`, {
      body: { benutzername, passwort },
    });
    if (angenommen.status !== 201) throw new Error(`annehmen ${angenommen.status}`);
    const { nutzerId } = (await angenommen.json()) as { nutzerId: string };
    const an = await b.anfrage("/api/auth/sign-in/username", {
      body: { username: benutzername, password: passwort },
    });
    if (an.status !== 200) throw new Error(`sign-in ${an.status}`);
    const aktiv = await b.anfrage("/api/auth/organization/set-active", {
      body: { organizationId: inhaber.betriebId },
    });
    if (aktiv.status !== 200) throw new Error(`set-active ${aktiv.status}`);
    return { ...b, nutzerId, token };
  };

  return {
    ...datenbank,
    app,
    auth,
    browser,
    geheimerSchluessel,
    vapid,
    jetzt,
    inhaberMitBetrieb,
    eingeladen,
    stelleUhr: (ms: number) => {
      uhr = ms;
    },
  };
};

import { createApp } from "./app.ts";
import { createAuth } from "./auth/auth.ts";
import { testDatenbank } from "./db/test-db.ts";

export const TEST_URL = "http://localhost:28200";

/**
 * A server on a fresh test database with Better Auth, and helpers to act as people over HTTP, as a
 * browser would (cookies between calls)
 */
export const testServer = (optionen: { log?: (line: string) => void; uhr?: () => number } = {}) => {
  const datenbank = testDatenbank();
  let uhr = 1_790_000_000_000;
  const jetzt = optionen.uhr ?? (() => uhr);
  const auth = createAuth({
    db: datenbank.db,
    schreibDb: datenbank.schreibDb,
    geheimerSchluessel: crypto.getRandomValues(new Uint8Array(32)),
    url: TEST_URL,
    jetzt,
  });
  const app = createApp({
    log: optionen.log ?? (() => undefined),
    now: jetzt,
    version: "test",
    db: datenbank.db,
    schreibDb: datenbank.schreibDb,
    auth,
    url: TEST_URL,
  });

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

  return {
    ...datenbank,
    app,
    auth,
    browser,
    inhaberMitBetrieb,
    stelleUhr: (ms: number) => {
      uhr = ms;
    },
  };
};

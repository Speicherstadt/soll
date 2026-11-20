import { Hono } from "hono";
import type { Auth } from "./auth/auth.ts";
import type { Db, SchreibDb } from "./db/oeffnen.ts";
import { formatRequestLog, type LogSink, redactUrl } from "./log.ts";
import type { Mailer } from "./modules/mail/index.ts";
import { pinSchluesselAus } from "./modules/terminal/index.ts";
import { betriebRouten } from "./routes/betrieb.ts";
import { dienstplanRouten } from "./routes/dienstplan.ts";
import { einladungRouten, oeffentlicheEinladungRouten } from "./routes/einladungen.ts";
import { einrichtungRouten } from "./routes/einrichtung.ts";
import { kioskRouten } from "./routes/kiosk.ts";
import { type Anfrage, angemeldet } from "./routes/kontext.ts";
import { modellRouten } from "./routes/modelle.ts";
import { modulRouten } from "./routes/module.ts";
import { monatRouten } from "./routes/monat.ts";
import { pinPruefRouten, pinRouten } from "./routes/pins.ts";
import { pruefRouten } from "./routes/pruefen.ts";
import { standortRouten } from "./routes/standorte.ts";
import { terminalRouten } from "./routes/terminals.ts";
import { zeitRouten } from "./routes/zeiten.ts";

export type AppDeps = {
  /** Where log lines go; stdout in production, a list in tests */
  log: LogSink;
  /** The clock, passed in so tests can fix it */
  now: () => number;
  version: string;
  db: Db;
  schreibDb: SchreibDb;
  auth: Auth;
  /** Where the instance is reached, for links in invitations and on time sheets */
  url: string;
  /** Mail over SMTP from the configuration; null while none is set (S-306) */
  mail: Mailer | null;
  /** SOLL_SECRET_KEY, decoded: the key of the PIN lookup is derived from it (S-801) */
  geheimerSchluessel: Uint8Array;
};

/** The HTTP app: routes stay thin and call into src/modules (CLAUDE.md) */
export const createApp = (deps: AppDeps) => {
  const { log, now, version, db, schreibDb, auth, url, mail } = deps;
  const pinSchluessel = pinSchluesselAus(deps.geheimerSchluessel);
  const app = new Hono();

  app.use(async (c, next) => {
    const start = now();
    await next();
    log(
      formatRequestLog({
        time: new Date(start).toISOString(),
        method: c.req.method,
        path: redactUrl(c.req.url),
        status: c.res.status,
        ms: now() - start,
      }),
    );
  });

  app.get("/health", (c) => c.json({ status: "ok", version }));
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  app.route("/api/v1/einladung", oeffentlicheEinladungRouten(db, schreibDb, auth, now));
  app.route("/api/v1/pruefen", pruefRouten(db));
  // the tablet with its device token, not a session (S-801)
  app.route("/api/v1/kiosk", kioskRouten(db, schreibDb, now, pinSchluessel));

  const v1 = new Hono<Anfrage>()
    .use(angemeldet(auth, db))
    .route("/betrieb", betriebRouten(db, schreibDb, now))
    .route("/einrichtung", einrichtungRouten(db, schreibDb, now))
    .route("/standorte", standortRouten(db, schreibDb, now))
    .route("/einladungen", einladungRouten(schreibDb, url, now))
    .route("/pins", pinRouten(db, schreibDb, now, pinSchluessel))
    .route("/terminal/pins", pinPruefRouten(db, schreibDb, now))
    .route(
      "/",
      modulRouten(db, {
        arbeitszeit: {
          "/modelle": modellRouten(db, schreibDb, now),
          "/monat": monatRouten(db, schreibDb, now, { url, mail }),
          "/": zeitRouten(db, schreibDb, now),
        },
        dienstplan: { "/": dienstplanRouten(db, schreibDb, now) },
        terminal: { "/": terminalRouten(db, schreibDb, now) },
      }),
    );
  app.route("/api/v1", v1);

  return app;
};

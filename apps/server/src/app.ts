import { Hono } from "hono";
import type { Auth } from "./auth/auth.ts";
import type { Db, SchreibDb } from "./db/oeffnen.ts";
import { formatRequestLog, type LogSink, redactUrl } from "./log.ts";
import type { Mailer } from "./modules/mail/index.ts";
import { auskunftRouten } from "./routes/auskunft.ts";
import { betriebRouten } from "./routes/betrieb.ts";
import { buchungRouten } from "./routes/buchungen.ts";
import { datevRouten } from "./routes/datev.ts";
import { dienstplanRouten } from "./routes/dienstplan.ts";
import { einladungRouten, oeffentlicheEinladungRouten } from "./routes/einladungen.ts";
import { einrichtungRouten } from "./routes/einrichtung.ts";
import { erinnerungRouten } from "./routes/erinnerungen.ts";
import { type Anfrage, angemeldet } from "./routes/kontext.ts";
import { kundenRouten } from "./routes/kunden.ts";
import { modellRouten } from "./routes/modelle.ts";
import { modulRouten } from "./routes/module.ts";
import { monatRouten } from "./routes/monat.ts";
import { pinPruefRouten, pinRouten } from "./routes/pins.ts";
import { projektRouten } from "./routes/projekte.ts";
import { pruefRouten } from "./routes/pruefen.ts";
import { pruefexportRouten } from "./routes/pruefexport.ts";
import { satzRouten } from "./routes/saetze.ts";
import { standortRouten } from "./routes/standorte.ts";
import { stoppuhrRouten } from "./routes/stoppuhr.ts";
import { taetigkeitRouten } from "./routes/taetigkeiten.ts";
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
  /** The key of the encrypted columns (SOLL_SECRET_KEY) and the public VAPID key (S-307) */
  geheimerSchluessel: Uint8Array;
  vapidOeffentlich: string;
};

/** The HTTP app: routes stay thin and call into src/modules (CLAUDE.md) */
export const createApp = ({
  log,
  now,
  version,
  db,
  schreibDb,
  auth,
  url,
  mail,
  geheimerSchluessel,
  vapidOeffentlich,
}: AppDeps) => {
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

  const v1 = new Hono<Anfrage>()
    .use(angemeldet(auth, db))
    .route("/betrieb", betriebRouten(db, schreibDb, now))
    .route("/auskunft", auskunftRouten(db, now))
    .route("/einrichtung", einrichtungRouten(db, schreibDb, now))
    .route("/standorte", standortRouten(db, schreibDb, now))
    .route("/einladungen", einladungRouten(schreibDb, url, now))
    .route("/pins", pinRouten(db, schreibDb, now))
    .route("/terminal/pins", pinPruefRouten(db, schreibDb, now))
    .route(
      "/",
      modulRouten(db, {
        arbeitszeit: {
          "/modelle": modellRouten(db, schreibDb, now),
          "/datev": datevRouten(db, schreibDb, now),
          "/monat": monatRouten(db, schreibDb, now, { url, mail }),
          "/pruefexport": pruefexportRouten(db, now, { url }),
          "/erinnerungen": erinnerungRouten(db, schreibDb, now, {
            geheimerSchluessel,
            vapidOeffentlich,
            mailKonfiguriert: mail !== null,
          }),
          "/": zeitRouten(db, schreibDb, now),
        },
        projektzeit: {
          "/kunden": kundenRouten(db, schreibDb, now),
          "/projekte": projektRouten(db, schreibDb, now),
          "/taetigkeiten": taetigkeitRouten(db, schreibDb, now),
          "/saetze": satzRouten(db, schreibDb, now),
          "/stoppuhr": stoppuhrRouten(db, schreibDb, now),
          "/buchungen": buchungRouten(db, schreibDb, now),
        },
        dienstplan: { "/": dienstplanRouten(db, schreibDb, now) },
      }),
    );
  app.route("/api/v1", v1);

  return app;
};

import { Hono } from "hono";
import type { Auth } from "./auth/auth.ts";
import type { Db, SchreibDb } from "./db/oeffnen.ts";
import { formatRequestLog, type LogSink, redactUrl } from "./log.ts";
import type { Schichtquelle } from "./modules/arbeitszeit/index.ts";
import { schichtquelle } from "./modules/dienstplan/index.ts";
import type { Push } from "./modules/erinnerungen/index.ts";
import type { Mailer } from "./modules/mail/index.ts";
import { terminalSchluesselAus } from "./modules/terminal/index.ts";
import {
  CLOCKODO_API,
  type ClockodoDeps,
  type Dateispeicher,
  type KimaiDeps,
  sicherHolen,
} from "./modules/umzug/index.ts";
import { ratenGrenze } from "./modules/zugaenge/index.ts";
import { abwesenheitRouten } from "./routes/abwesenheiten.ts";
import { auskunftRouten } from "./routes/auskunft.ts";
import { auslastungRouten } from "./routes/auslastung.ts";
import { betriebRouten } from "./routes/betrieb.ts";
import { buchungRouten } from "./routes/buchungen.ts";
import { datevRouten } from "./routes/datev.ts";
import { dienstplanRouten } from "./routes/dienstplan.ts";
import { feedRouten } from "./routes/dienstplan-kalender.ts";
import { einladungRouten, oeffentlicheEinladungRouten } from "./routes/einladungen.ts";
import { einrichtungRouten } from "./routes/einrichtung.ts";
import { erinnerungRouten } from "./routes/erinnerungen.ts";
import { habenRouten } from "./routes/haben.ts";
import { importRouten } from "./routes/importe.ts";
import { kartenRouten } from "./routes/karten.ts";
import { kioskRouten } from "./routes/kiosk.ts";
import { kontenRouten } from "./routes/konten.ts";
import { type Anfrage, angemeldet } from "./routes/kontext.ts";
import { kundenRouten } from "./routes/kunden.ts";
import { mcpRouten } from "./routes/mcp.ts";
import { modellRouten } from "./routes/modelle.ts";
import { modulRouten } from "./routes/module.ts";
import { monatRouten } from "./routes/monat.ts";
import { openapiRouten } from "./routes/openapi.ts";
import { personenRouten } from "./routes/personen.ts";
import { pinRouten } from "./routes/pins.ts";
import { projektRouten } from "./routes/projekte.ts";
import { pruefRouten } from "./routes/pruefen.ts";
import { pruefexportRouten } from "./routes/pruefexport.ts";
import { satzRouten } from "./routes/saetze.ts";
import { standortRouten } from "./routes/standorte.ts";
import { stoppuhrRouten } from "./routes/stoppuhr.ts";
import { stundennachweisRouten } from "./routes/stundennachweise.ts";
import { taetigkeitRouten } from "./routes/taetigkeiten.ts";
import { terminalRouten } from "./routes/terminals.ts";
import { verfahrensdokuRouten } from "./routes/verfahrensdoku.ts";
import { zeitRouten } from "./routes/zeiten.ts";
import { zugangRouten } from "./routes/zugaenge.ts";
import { webAuslieferung } from "./web.ts";

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
  /** The planned shifts for absences (S-401); the plan itself (S-501) unless a test passes one */
  schichten?: Schichtquelle;
  /**
   * The key of the encrypted columns (SOLL_SECRET_KEY; the key of the PIN lookup is derived from it,
   * S-801) and the public VAPID key (S-307)
   */
  geheimerSchluessel: Uint8Array;
  vapidOeffentlich: string;
  /** The static build of apps/web (SOLL_WEB_DIR); absent, the server serves the API only */
  webVerzeichnis?: string | null;
  /** How the server calls a business's Haben (S-606); a stand-in in tests, never the network */
  habenFetch?: typeof fetch;
  /** Web Push for messages about the plan (S-503); without it they go by mail only */
  push?: Push | null;
  /** The content-addressed store of the original files of imports (S-701) */
  dateien: Dateispeicher;
  /** How the server calls Clockodo's API for an import (S-703); a stand-in in tests */
  clockodo?: ClockodoDeps;
  /** How the server calls a Kimai instance for an import (S-705); a stand-in in tests */
  kimai?: KimaiDeps;
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
  schichten,
  geheimerSchluessel,
  vapidOeffentlich,
  webVerzeichnis = null,
  habenFetch = fetch,
  push = null,
  dateien,
  clockodo = { fetch, basis: CLOCKODO_API },
  kimai = { holen: sicherHolen(), erlaubt: new Set() },
}: AppDeps) => {
  const terminalSchluessel = terminalSchluesselAus(geheimerSchluessel);
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
  app.route("/api/v1/pruefen", pruefRouten(db, now));
  app.route("/api/v1/openapi.json", openapiRouten({ version, url }));

  // one limit per token for the REST API and the MCP server together (S-607)
  const zugang = { schreibDb, jetzt: now, grenze: ratenGrenze() };
  app.route(
    "/mcp",
    mcpRouten({ db, zugang, version, url, fetch: (anfrage, env) => app.fetch(anfrage, env) }),
  );
  // the calendar feed with its secret token, for a calendar app without a session (S-503)
  app.route("/api/v1/ics", feedRouten(db, now));
  // the tablet with its device token, not a session (S-801)
  app.route("/api/v1/kiosk", kioskRouten(db, schreibDb, now, terminalSchluessel));

  const v1 = new Hono<Anfrage>()
    .use(angemeldet(auth, db, zugang))
    .route("/betrieb", betriebRouten(db, schreibDb, now))
    .route("/auskunft", auskunftRouten(db, now))
    .route("/einrichtung", einrichtungRouten(db, schreibDb, now))
    .route("/standorte", standortRouten(db, schreibDb, now))
    .route("/einladungen", einladungRouten(schreibDb, url, now))
    .route("/personen", personenRouten(db, schreibDb, now))
    .route("/zugaenge", zugangRouten(db, schreibDb, now))
    .route("/verfahrensdoku", verfahrensdokuRouten(db, schreibDb, now, version))
    .route("/importe", importRouten(db, schreibDb, now, dateien, { clockodo, kimai }))
    .route(
      "/",
      modulRouten(db, {
        arbeitszeit: {
          "/modelle": modellRouten(db, schreibDb, now),
          "/datev": datevRouten(db, schreibDb, now),
          "/monat": monatRouten(db, schreibDb, now, { url, mail }),
          "/abwesenheiten": abwesenheitRouten(db, schreibDb, now, {
            mail,
            schichten: schichten ?? schichtquelle(db),
          }),
          "/konten": kontenRouten(db, schreibDb, now),
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
          "/stundennachweise": stundennachweisRouten(db, schreibDb, now),
          "/auslastung": auslastungRouten(db, schreibDb, now),
          "/haben": habenRouten(db, schreibDb, now, {
            schluessel: geheimerSchluessel,
            holen: habenFetch,
          }),
        },
        dienstplan: {
          "/": dienstplanRouten(db, schreibDb, now, {
            zustellung: { db, schreibDb, geheimerSchluessel, url, push, mail },
            url,
          }),
        },
        terminal: {
          "/pins": pinRouten(db, schreibDb, now, terminalSchluessel.pin),
          "/karten": kartenRouten(db, schreibDb, now, terminalSchluessel),
          "/": terminalRouten(db, schreibDb, now),
        },
      }),
    );
  app.route("/api/v1", v1);
  // Last, so every route of the API wins; unknown API paths stay 404 (src/web.ts)
  if (webVerzeichnis) app.get("*", webAuslieferung(webVerzeichnis));

  return app;
};

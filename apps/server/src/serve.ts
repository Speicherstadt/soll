import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { createAuth } from "./auth/auth.ts";
import { oeffneDatenbank } from "./db/oeffnen.ts";
import { parseEnv } from "./env.ts";
import { aussonderungsSchleife } from "./modules/arbeitszeit/index.ts";
import {
  erinnerungsSchleife,
  pushPerFetch,
  vapidKontakt,
  vapidLaden,
} from "./modules/erinnerungen/index.ts";
import { smtpMailer } from "./modules/mail/index.ts";
import { DATENBANK } from "./modules/sicherung/index.ts";
import {
  CLOCKODO_API,
  dateispeicher,
  PERSONIO_API,
  SCHICHTPLANER_ADRESSEN,
  type SchichtplanerAdressen,
  sicherHolen,
  TOGGL_API,
} from "./modules/umzug/index.ts";

const lesen = () => {
  try {
    return parseEnv(process.env);
  } catch (fehler) {
    // The reason names the variable, never its value (src/env.ts)
    const gruende = (fehler as { issues?: { message: string }[] }).issues?.map(
      (issue) => issue.message,
    );
    console.error(
      JSON.stringify({ msg: "refusing to start", gruende: gruende ?? [String(fehler)] }),
    );
    process.exit(1);
  }
};

/** Starts the server: settings, database with its migrations, VAPID keys, reminders, HTTP */
/** The shift planners' addresses, or all of one stand-in, whose paths do not overlap (S-706) */
const adressenVon = (ersatz: string | null): SchichtplanerAdressen =>
  ersatz === null
    ? SCHICHTPLANER_ADRESSEN
    : {
        papershift: `${ersatz}/public_api/v1`,
        planday: ersatz,
        plandayId: ersatz,
        crewmeister: ersatz,
      };

export const serverStarten = () => {
  const env = lesen();
  mkdirSync(env.dataDir, { recursive: true });
  // Opening applies the migrations embedded in the binary (src/db/migrationen.gen.ts)
  const { db, schreibDb } = oeffneDatenbank(join(env.dataDir, DATENBANK), Date.now());
  const auth = createAuth({
    db,
    schreibDb,
    geheimerSchluessel: env.geheimerSchluessel,
    url: env.url,
    jetzt: Date.now,
  });

  // The instance creates its VAPID key pair on the first start (S-307)
  const vapid = vapidLaden(db, schreibDb, env.geheimerSchluessel, Date.now());
  const mail = env.smtp ? smtpMailer(env.smtp.url, env.smtp.von) : null;
  const kontakt = vapidKontakt(env.url, env.smtp?.von);

  // the original files of imports beside the database (S-701)
  const dateien = dateispeicher(() => join(env.dataDir, "dateien"));
  const app = createApp({
    log: (line) => console.log(line),
    now: Date.now,
    version: env.version,
    db,
    schreibDb,
    auth,
    url: env.url,
    mail,
    geheimerSchluessel: env.geheimerSchluessel,
    vapidOeffentlich: vapid.oeffentlich,
    webVerzeichnis: env.webDir,
    // messages about the plan go the same way as the reminders (S-503)
    push: { vapid, kontakt, senden: pushPerFetch },
    dateien,
    // Clockodo's API for imports (S-703); another address only for a stand-in in the e2e tests
    clockodo: { fetch, basis: env.clockodoApi ?? CLOCKODO_API },
    // Kimai instances for imports (S-705): public https only, unless the operator allows an origin
    kimai: { holen: sicherHolen(), erlaubt: env.importErlaubt },
    // Personio's API for imports (S-704) at its fixed address; another only for the e2e stand-in
    personio: { holen: sicherHolen(), basis: env.personioApi ?? PERSONIO_API },
    // Papershift, Planday and Crewmeister at their own addresses (S-706); a stand-in only in e2e
    schichtplaner: { holen: sicherHolen(), adressen: adressenVon(env.schichtplanerApi) },
    // Toggl Track and Clockify at their fixed addresses (S-707); stand-ins only in e2e
    toggl: { holen: sicherHolen(), basis: env.togglApi ?? TOGGL_API },
    clockify: { holen: sicherHolen(), basis: env.clockifyApi },
  });

  // Reminders every minute; the loop reads stamps and never writes one (S-307)
  erinnerungsSchleife(
    {
      db,
      schreibDb,
      geheimerSchluessel: env.geheimerSchluessel,
      vapid,
      url: env.url,
      kontakt,
      push: pushPerFetch,
      mail,
    },
    Date.now,
    (zeile) => console.log(zeile),
  );

  // Removal after the retention period, at the start and every 6 hours (S-901)
  aussonderungsSchleife(db, schreibDb, Date.now, (zeile) => console.log(zeile), undefined, {
    dateiLoeschen: (sha) => void dateien.loeschen(sha),
  });

  const server = Bun.serve({ port: env.port, hostname: env.host, fetch: app.fetch });
  console.log(JSON.stringify({ msg: "listening", url: server.url.href }));
};

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { createAuth } from "./auth/auth.ts";
import { oeffneDatenbank } from "./db/oeffnen.ts";
import { parseEnv } from "./env.ts";
import {
  erinnerungsSchleife,
  pushPerFetch,
  vapidKontakt,
  vapidLaden,
} from "./modules/erinnerungen/index.ts";
import { smtpMailer } from "./modules/mail/index.ts";

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

const env = lesen();
mkdirSync(env.dataDir, { recursive: true });
// Opening applies the migrations embedded in the binary (src/db/migrationen.gen.ts)
const { db, schreibDb } = oeffneDatenbank(join(env.dataDir, "soll.db"), Date.now());
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
});

// Reminders every minute; the loop reads stamps and never writes one (S-307)
erinnerungsSchleife(
  {
    db,
    schreibDb,
    geheimerSchluessel: env.geheimerSchluessel,
    vapid,
    url: env.url,
    kontakt: vapidKontakt(env.url, env.smtp?.von),
    push: pushPerFetch,
    mail,
  },
  Date.now,
  (zeile) => console.log(zeile),
);

const server = Bun.serve({ port: env.port, hostname: env.host, fetch: app.fetch });
console.log(JSON.stringify({ msg: "listening", url: server.url.href }));

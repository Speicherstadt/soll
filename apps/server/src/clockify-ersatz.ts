import { Hono } from "hono";

/*
 * Stand-in for Clockify's API v1 (docs.clockify.me, BAULISTE.md S-707):
 * X-Api-Key auth, GET /user, /workspaces/:ws/clients, /projects, /projects/:id/tasks,
 * /user/:userId/time-entries with page, page-size and Last-Page header. 401 on wrong key,
 * 403 on missing permission, 429 on rate limit.
 */

export type ClockifyErsatzDaten = {
  user: Record<string, unknown>;
  clients: readonly Record<string, unknown>[];
  projects: readonly Record<string, unknown>[];
  tasks: Record<string, readonly Record<string, unknown>[]>;
  timeEntries: readonly Record<string, unknown>[];
};

export type ClockifyErsatzOptionen = {
  schluessel: string;
  daten: ClockifyErsatzDaten;
  verbotenerSchluessel?: string;
  seitengroesse?: number;
  rateLimit?: boolean;
  aufrufe?: string[];
};

const seiteVon = <T>(liste: readonly T[], seite: number, groesse: number) => {
  const start = (seite - 1) * groesse;
  const daten = liste.slice(start, start + groesse);
  const letzte = start + groesse >= liste.length;
  return { daten, letzte };
};

export const clockifyErsatz = (opt: ClockifyErsatzOptionen) => {
  const groesseDefault = opt.seitengroesse ?? 200;
  const app = new Hono();

  app.use("*", async (c, next) => {
    opt.aufrufe?.push(`${c.req.method} ${c.req.path}`);
    const key = c.req.header("x-api-key");
    if (opt.verbotenerSchluessel && key === opt.verbotenerSchluessel)
      return c.json({ message: "forbidden" }, 403);
    if (key !== opt.schluessel) return c.json({ message: "unauthorized" }, 401);
    if (opt.rateLimit) return c.json({ message: "rate limit" }, 429, { "Retry-After": "15" });
    await next();
  });

  app.get("/user", (c) => c.json(opt.daten.user));
  app.get("/workspaces/:ws/clients", (c) => {
    const seite = Number(c.req.query("page") ?? 1);
    const groesse = Math.min(groesseDefault, Number(c.req.query("page-size") ?? groesseDefault));
    const { daten, letzte } = seiteVon(opt.daten.clients, seite, groesse);
    return c.json(daten, 200, { "Last-Page": String(letzte) });
  });
  app.get("/workspaces/:ws/projects", (c) => {
    const seite = Number(c.req.query("page") ?? 1);
    const groesse = Math.min(groesseDefault, Number(c.req.query("page-size") ?? groesseDefault));
    const { daten, letzte } = seiteVon(opt.daten.projects, seite, groesse);
    return c.json(daten, 200, { "Last-Page": String(letzte) });
  });
  app.get("/workspaces/:ws/projects/:pid/tasks", (c) => {
    const pid = c.req.param("pid");
    const seite = Number(c.req.query("page") ?? 1);
    const groesse = Math.min(groesseDefault, Number(c.req.query("page-size") ?? groesseDefault));
    const { daten, letzte } = seiteVon(opt.daten.tasks[pid] ?? [], seite, groesse);
    return c.json(daten, 200, { "Last-Page": String(letzte) });
  });
  app.get("/workspaces/:ws/user/:uid/time-entries", (c) => {
    const seite = Number(c.req.query("page") ?? 1);
    const groesse = Math.min(groesseDefault, Number(c.req.query("page-size") ?? groesseDefault));
    const { daten, letzte } = seiteVon(opt.daten.timeEntries, seite, groesse);
    return c.json(daten, 200, { "Last-Page": String(letzte) });
  });

  return app;
};

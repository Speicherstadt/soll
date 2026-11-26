import { Hono } from "hono";

/*
 * Stand-in for Toggl Track's API v9 (engineering.toggl.com, BAULISTE.md S-707):
 * GET /me, /me/clients, /me/projects, /me/tasks, /me/time_entries with Basic auth
 * `<token>:api_token`. 403 on wrong token, 402 with X-Toggl-Quota-Resets-In when quota is
 * exhausted, 429 on rate limit.
 */

export type TogglErsatzDaten = {
  me: Record<string, unknown>;
  clients: readonly Record<string, unknown>[];
  projects: readonly Record<string, unknown>[];
  tasks: readonly Record<string, unknown>[];
  time_entries: readonly Record<string, unknown>[];
};

export type TogglErsatzOptionen = {
  token: string;
  daten: TogglErsatzDaten;
  /** Remaining requests before 402 (default unlimited) */
  kontingent?: number;
  resetSekunden?: number;
  rateLimit?: boolean;
  aufrufe?: string[];
};

export const togglErsatz = (opt: TogglErsatzOptionen) => {
  const erwartet = `Basic ${Buffer.from(`${opt.token}:api_token`).toString("base64")}`;
  let uebrig = opt.kontingent ?? Number.POSITIVE_INFINITY;

  const app = new Hono();
  app.use("*", async (c, next) => {
    opt.aufrufe?.push(`${c.req.method} ${c.req.path}`);
    if (c.req.header("authorization") !== erwartet) return c.json({ error: "unauthorized" }, 403);
    if (opt.rateLimit) return c.json({ error: "rate limit" }, 429, { "Retry-After": "12" });
    if (uebrig <= 0)
      return c.json({ error: "quota" }, 402, {
        "X-Toggl-Quota-Resets-In": String(opt.resetSekunden ?? 120),
      });
    uebrig -= 1;
    await next();
  });

  app.get("/me", (c) => c.json(opt.daten.me));
  app.get("/me/clients", (c) => c.json(opt.daten.clients));
  app.get("/me/projects", (c) => c.json(opt.daten.projects));
  app.get("/me/tasks", (c) => c.json(opt.daten.tasks));
  app.get("/me/time_entries", (c) => {
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    const gefiltert = opt.daten.time_entries.filter((e) => {
      const tag = typeof e.start === "string" ? e.start.slice(0, 10) : "";
      if (startDate && tag < startDate) return false;
      if (endDate && tag > endDate) return false;
      return true;
    });
    return c.json(gefiltert);
  });

  return app;
};

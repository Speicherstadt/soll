import { Hono } from "hono";
import { formatRequestLog, type LogSink, redactUrl } from "./log.ts";

export type AppDeps = {
  /** Where log lines go; stdout in production, a list in tests */
  log: LogSink;
  /** The clock, passed in so tests can fix it */
  now: () => number;
  version: string;
};

/** The HTTP app: routes stay thin and call into src/modules (CLAUDE.md) */
export const createApp = ({ log, now, version }: AppDeps) => {
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

  return app;
};

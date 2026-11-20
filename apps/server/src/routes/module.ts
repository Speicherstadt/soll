import { Hono } from "hono";
import type { Db } from "../db/oeffnen.ts";
import { MODULE } from "../modules/betrieb/index.ts";
import { type Anfrage, modul } from "./kontext.ts";

/**
 * The route groups of the modules: every route below /api/v1/<modul> passes `modul`, so a module
 * the business switched off is refused there. Each group answers /status; its routes come with
 * their items (S-304, S-501, S-601, S-801).
 */
export const modulRouten = (db: Db) =>
  MODULE.reduce(
    (app, name) =>
      app.route(
        `/${name}`,
        new Hono<Anfrage>()
          .use(modul(db, name))
          .get("/status", (c) => c.json({ modul: name, aktiv: true })),
      ),
    new Hono<Anfrage>(),
  );

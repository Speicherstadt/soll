import { Hono } from "hono";
import type { Db } from "../db/oeffnen.ts";
import { MODULE, type Modul } from "../modules/betrieb/index.ts";
import { type Anfrage, modul } from "./kontext.ts";

/**
 * The route groups of the modules: every route below /api/v1/<modul> passes `modul`, so a module
 * the business switched off is refused there. Each group answers /status; its routes come with
 * their items (S-303: the working-time models; S-304, S-501, S-601, S-801).
 */
export const modulRouten = (
  db: Db,
  routen: Partial<Record<Modul, Record<string, Hono<Anfrage>>>> = {},
) =>
  MODULE.reduce(
    (app, name) =>
      app.route(
        `/${name}`,
        Object.entries(routen[name] ?? {}).reduce(
          (gruppe, [pfad, unter]) => gruppe.route(pfad, unter),
          new Hono<Anfrage>()
            .use(modul(db, name))
            .get("/status", (c) => c.json({ modul: name, aktiv: true })),
        ),
      ),
    new Hono<Anfrage>(),
  );

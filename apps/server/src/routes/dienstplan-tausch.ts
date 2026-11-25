import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import type { Kontext } from "../modules/audit/index.ts";
import {
  planMelden,
  type TauschErgebnis,
  tauschAblehnen,
  tauschAnbieten,
  tauschbuch,
  tauschFreigeben,
  tauschregelSetzen,
  tauschUebernehmen,
  tauschZurueckziehen,
} from "../modules/dienstplan/index.ts";
import type { ZustellDeps } from "../modules/erinnerungen/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";

const id = z.string().min(1).max(100);

export const angebotSchema = z
  .object({ schichtId: id, anNutzerId: id.nullable().default(null) })
  .strict();
/** A refusal says why: both parties read it */
export const ablehnungSchema = z.object({ grund: z.string().trim().min(1).max(500) }).strict();
export const tauschregelSchema = z.object({ ohneFreigabe: z.boolean() }).strict();

const STATUS = {
  unbekannt: 404,
  person_unbekannt: 404,
  nicht_deine: 403,
  nicht_fuer_dich: 403,
  abgelaufen: 409,
  hinfaellig: 409,
  schon_angeboten: 409,
  nicht_offen: 409,
  ueberschneidung: 409,
} as const;

type Schritt = (kontext: Kontext, tauschId: string) => TauschErgebnis;

/**
 * Answers a step of a swap: the swap as it is now, after telling whom the step concerns (S-503's
 * delivery, before the answer)
 */
const antworten = async (
  c: Context<Anfrage>,
  zustellung: ZustellDeps | null,
  kontext: Kontext,
  ergebnis: TauschErgebnis,
  status: 200 | 201 = 200,
) => {
  if (!ergebnis.ok) return c.json({ fehler: ergebnis.grund }, STATUS[ergebnis.grund]);
  await planMelden(zustellung, kontext, ergebnis.meldungen);
  return c.json(ergebnis.tausch, status);
};

/**
 * The shift swap below /api/v1/dienstplan/tausch (S-504): everyone who reads the plan offers own
 * published shifts and takes offers meant for them; owner and planner approve or refuse; the owner
 * sets whether a takeover needs approval
 */
export const tauschRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  zustellung: ZustellDeps | null,
) => {
  const schritt = (tun: Schritt) => async (c: Context<Anfrage>) => {
    const kontext = kontextVon(c, jetzt);
    return antworten(c, zustellung, kontext, tun(kontext, c.req.param("tauschId") ?? ""));
  };
  return new Hono<Anfrage>()
    .use(recht("plan:lesen"))
    .get("/", (c) =>
      c.json(
        tauschbuch(
          db,
          c.get("betriebId"),
          { nutzerId: c.get("nutzerId"), rolle: c.get("rolle") },
          jetzt(),
        ),
      ),
    )
    .post("/", async (c) => {
      const eingabe = await koerper(c, angebotSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = kontextVon(c, jetzt);
      return antworten(
        c,
        zustellung,
        kontext,
        tauschAnbieten(db, schreibDb, kontext, eingabe.data),
        201,
      );
    })
    .put("/regel", recht("betrieb:einrichten"), async (c) => {
      const eingabe = await koerper(c, tauschregelSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      tauschregelSetzen(db, schreibDb, kontextVon(c, jetzt), eingabe.data.ohneFreigabe);
      return c.json(eingabe.data);
    })
    .post(
      "/:tauschId/uebernehmen",
      schritt((kontext, tauschId) => tauschUebernehmen(db, schreibDb, kontext, tauschId)),
    )
    .post(
      "/:tauschId/freigeben",
      recht("plan:planen"),
      schritt((kontext, tauschId) => tauschFreigeben(db, schreibDb, kontext, tauschId)),
    )
    .post("/:tauschId/ablehnen", recht("plan:planen"), async (c) => {
      const eingabe = await koerper(c, ablehnungSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = kontextVon(c, jetzt);
      const ergebnis = tauschAblehnen(
        db,
        schreibDb,
        kontext,
        c.req.param("tauschId"),
        eingabe.data.grund,
      );
      return antworten(c, zustellung, kontext, ergebnis);
    })
    .delete(
      "/:tauschId",
      schritt((kontext, tauschId) => tauschZurueckziehen(db, schreibDb, kontext, tauschId)),
    );
};

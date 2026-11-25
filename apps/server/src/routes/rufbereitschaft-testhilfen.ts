import { expect } from "vitest";
import type { testServer } from "../test-server.ts";
import { type Json, json, type Person, um, weber } from "./monat-testhilfen.ts";

/*
 * Weber Haustechnik with the plan for Rufbereitschaft (S-505): Sandra on call, Anna who plans, the
 * test clock on Friday 20 November 2026, 9:00
 */

export const RUF = "/api/v1/dienstplan/rufdienste";
export const EINSAETZE = "/api/v1/arbeitszeit/einsaetze";
export const QUELLEN = "/api/v1/arbeitszeit/sollquellen";

export const mitPlan = async (optionen: Parameters<typeof testServer>[0] = {}) => {
  const w = await weber(optionen);
  await w.jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
  const orte = (await json(await w.jonas.anfrage("/api/v1/standorte"))).standorte as Json[];
  const standortId = orte[0]?.standortId as string;
  return { ...w, standortId };
};

/** A Rufbereitschaft of a person from a day and clock times, published at once unless asked */
export const rufPlanen = async (
  wer: Person,
  body: Json,
  veroeffentlichen = true,
): Promise<{ antwort: Response; rufdienst: Json }> => {
  const antwort = await wer.anfrage(RUF, { body });
  const rufdienst = await json(antwort.clone());
  if (veroeffentlichen && antwort.status === 201) {
    const fertig = await wer.anfrage("/api/v1/dienstplan/veroeffentlichen", {
      body: { standortId: body.standortId, tag: body.tag },
    });
    expect(fertig.status).toBe(200);
  }
  return { antwort, rufdienst };
};

export const abends = (standortId: string, nutzerId: string, tag = "2026-11-19") => ({
  standortId,
  nutzerId,
  tag,
  beginnMinute: 18 * 60,
  endeMinute: 6 * 60,
  reaktionMinuten: 45,
});

export const nachtragen = (wer: Person, body: Json) => wer.anfrage(EINSAETZE, { body });

export const einsatz = (beginn: string, ende: string, mehr: Json = {}) => ({
  beginn: um(beginn),
  ende: um(ende),
  grund: "Heizung ausgefallen",
  ...mehr,
});

export const summen = async (wer: Person, monat = "2026-11", nutzerId?: string) =>
  (
    (
      await json(
        await wer.anfrage(
          `/api/v1/arbeitszeit/monat?monat=${monat}${nutzerId ? `&nutzerId=${nutzerId}` : ""}`,
        ),
      )
    ).inhalt as Json
  ).summen as Json;

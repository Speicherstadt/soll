/**
 * Absences and the shift plan (S-401 with S-501): a request shows the person's own planned shifts
 * in its span, a sickness reports the planned shifts from today as open to whoever plans
 */
import { describe, expect, it } from "vitest";
import { schreiben } from "../modules/audit/index.ts";
import { smtpMailer } from "../modules/mail/index.ts";
import { smtpTestServer } from "../modules/mail/smtp-test.ts";
import { antrag, json, krank, um, weberMitAbwesenheiten } from "./abwesenheit-testhilfen.ts";
import type { Person, Server } from "./monat-testhilfen.ts";

type Weber = Awaited<ReturnType<typeof weberMitAbwesenheiten>>;

const adresse = (server: Server, wer: { nutzerId: string }, email: string) =>
  server.sqlite.run("UPDATE user SET email = ? WHERE id = ?", [email, wer.nutzerId]);

/** Weber with the module Dienstplan on, and a helper to plan a shift at the workshop */
const mitPlan = async (optionen: Parameters<typeof weberMitAbwesenheiten>[0] = {}) => {
  const w = await weberMitAbwesenheiten(optionen);
  await w.jonas.anfrage("/api/v1/betrieb/module", {
    method: "PATCH",
    body: { dienstplan: true },
  });
  const { standorte } = (await json(await w.jonas.anfrage("/api/v1/standorte"))) as {
    standorte: { standortId: string }[];
  };
  const standortId = standorte[0]?.standortId ?? "";
  /** A shift of `wer` on `tag`, 7 to 15 o'clock; published unless it stays a draft */
  const schicht = async (wer: Person, tag: string, entwurf = false) => {
    const antwort = await w.jonas.anfrage("/api/v1/dienstplan/schichten", {
      body: {
        standortId,
        tag,
        beginnMinute: 7 * 60,
        endeMinute: 15 * 60,
        rolle: "Montage",
        nutzerId: wer.nutzerId,
      },
    });
    expect(antwort.status).toBe(201);
    const { schichtId } = (await json(antwort)) as { schichtId: string };
    // publishing comes with S-503; until then the test publishes through the audit chain
    if (!entwurf)
      schreiben(
        w.server.schreibDb,
        { betriebId: w.jonas.betriebId, akteur: w.jonas.nutzerId, jetzt: um("2026-11-01T12:00Z") },
        (s) =>
          s.aendern("schichten", { schichtId }, { veroeffentlichtAm: um("2026-11-01T12:00Z") }),
      );
    return schichtId;
  };
  return { ...w, schicht };
};

const tageVon = (liste: unknown) => (liste as { tag: string }[]).map((s) => s.tag);

describe("Antrag mit eigenen Schichten (S-401, S-501)", () => {
  it("shows the person's own published shifts in the span, not drafts or others' shifts", async () => {
    const w = await mitPlan();
    const veroeffentlicht = await w.schicht(w.sandra, "2026-12-21");
    await w.schicht(w.sandra, "2026-12-22", true);
    await w.schicht(w.max, "2026-12-22");
    await w.schicht(w.sandra, "2026-12-28");
    const daten = await json(
      await antrag(w.sandra, { art: "urlaub", von: "2026-12-21", bis: "2026-12-23" }),
    );
    expect(daten.eigeneSchichten).toEqual([
      {
        schichtId: veroeffentlicht,
        nutzerId: w.sandra.nutzerId,
        tag: "2026-12-21",
        beginn: um("2026-12-21T07:00:00+01:00"),
        ende: um("2026-12-21T15:00:00+01:00"),
        bezeichnung: "Montage",
        entwurf: false,
      },
    ]);
  });

  it("shows no shifts while the module Dienstplan is off", async () => {
    const w = await mitPlan();
    await w.schicht(w.sandra, "2026-12-21");
    await w.jonas.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { dienstplan: false },
    });
    const daten = await json(
      await antrag(w.sandra, { art: "urlaub", von: "2026-12-21", bis: "2026-12-23" }),
    );
    expect(daten.eigeneSchichten).toEqual([]);
  });
});

describe("Krankmeldung mit offenen Schichten (S-401, S-501)", () => {
  // Friday 20 November 2026; the certificate is due on Monday the 23rd (from the fourth day)
  const plan = async (w: Weber & { schicht: Awaited<ReturnType<typeof mitPlan>>["schicht"] }) => {
    await w.schicht(w.sandra, "2026-11-19");
    await w.schicht(w.sandra, "2026-11-20");
    await w.schicht(w.sandra, "2026-11-21", true);
    await w.schicht(w.sandra, "2026-11-23");
    await w.schicht(w.sandra, "2026-11-25");
    await w.schicht(w.max, "2026-11-20");
  };

  it("reports the published shifts from today through the end of the sickness", async () => {
    const w = await mitPlan();
    await plan(w);
    const daten = await json(await krank(w.sandra, { art: "krank", bis: "2026-11-25" }));
    expect(tageVon(daten.offeneSchichten)).toEqual(["2026-11-20", "2026-11-23", "2026-11-25"]);
  });

  it("reaches to the day the certificate is due while the end is open", async () => {
    const w = await mitPlan();
    await plan(w);
    const daten = await json(await krank(w.sandra));
    expect(tageVon(daten.offeneSchichten)).toEqual(["2026-11-20", "2026-11-23"]);
  });

  it("tells whoever plans of the drafts too, payroll only of the published plan", async () => {
    const smtp = await smtpTestServer();
    const w = await mitPlan({ mail: smtpMailer(smtp.url, "Soll <soll@weber.test>") });
    adresse(w.server, w.anna, "anna@weber.test");
    adresse(w.server, w.lohn, "lohn@weber.test");
    await plan(w);
    await krank(w.sandra);
    const an = (wer: string) => smtp.empfangen.find((m) => m.an.includes(wer))?.text ?? "";
    expect(an("anna@weber.test")).toContain(
      "Offene Schichten: 20.11.2026 Montage, 21.11.2026 Montage (Entwurf), 23.11.2026 Montage",
    );
    expect(an("weber@betrieb.test")).toContain("21.11.2026 Montage (Entwurf)");
    expect(an("lohn@weber.test")).toContain(
      "Offene Schichten: 20.11.2026 Montage, 23.11.2026 Montage",
    );
    expect(an("lohn@weber.test")).not.toContain("Entwurf");
  });
});

import { describe, expect, it } from "vitest";
import { habenErsatz } from "../../haben-ersatz.ts";
import { kontakteLesen, kontaktLesen, type Leistung, leistungSenden } from "./haben-api.ts";

const ELBHOF = "8b0c2f4e-1d7a-4c3b-9e5f-0a1b2c3d4e5f";
const LIEFERANT = "3c1d0e9f-2a4b-4c5d-8e6f-7a8b9c0d1e2f";

const haben = () =>
  habenErsatz({
    kontakte: [
      {
        id: ELBHOF,
        name: "Elbhof Immobilien GmbH",
        kundennummer: "K-1001",
        hourlyRateCents: 7_000,
      },
      { id: LIEFERANT, name: "Großhandel Nord", kundennummer: null, isCustomer: false },
      { id: crypto.randomUUID(), name: "Alt GmbH", kundennummer: "K-0001", archived: true },
    ],
  });

const anschluss = (h: ReturnType<typeof haben>, token = h.token) => ({
  fetch: h.fetch,
  basis: `${h.basis}/api/v1`,
  token,
});

const leistung: Leistung = {
  contactId: ELBHOF,
  workedOn: "2026-11-20",
  minutes: 210,
  description: "Montage: Vorwand gesetzt",
  hourlyRateCents: 8_500,
  nonBillable: false,
  project: "Bad Elbhof",
  source: "soll",
  externalId: "b-1",
};

describe("Haben's REST API as docs/api.md describes it", () => {
  it("reads the contacts that are not archived, with the Bearer token", async () => {
    const h = haben();
    const antwort = await kontakteLesen(anschluss(h));
    expect(antwort.ok && antwort.wert.map((k) => k.name)).toEqual([
      "Elbhof Immobilien GmbH",
      "Großhandel Nord",
    ]);
    expect(h.anfragen()[0]?.pfad).toBe("/api/v1/kontakte?limit=500&offset=0");
  });

  it("reads page after page while Haben has more than 500 contacts", async () => {
    const viele = Array.from({ length: 1_203 }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Kunde ${i}`,
      kundennummer: null,
    }));
    const h = habenErsatz({ kontakte: viele });
    const antwort = await kontakteLesen(anschluss(h));
    expect(antwort.ok && antwort.wert.length).toBe(1_203);
    expect(h.anfragen().map((a) => a.pfad)).toEqual([
      "/api/v1/kontakte?limit=500&offset=0",
      "/api/v1/kontakte?limit=500&offset=500",
      "/api/v1/kontakte?limit=500&offset=1000",
    ]);
  });

  it("reads one contact, and an unknown one is refused", async () => {
    const h = haben();
    const eins = await kontaktLesen(anschluss(h), ELBHOF);
    expect(eins.ok && eins.wert).toMatchObject({
      name: "Elbhof Immobilien GmbH",
      kundennummer: "K-1001",
    });
    expect(await kontaktLesen(anschluss(h), crypto.randomUUID())).toMatchObject({
      ok: false,
      fehler: "abgelehnt",
      meldung: "Kontakt nicht gefunden.",
    });
  });

  it("sends a Leistung: 201 the first time, 200 and no second entry with the same externalId", async () => {
    const h = haben();
    const erst = await leistungSenden(anschluss(h), leistung);
    expect(erst).toMatchObject({ ok: true, status: 201, wert: { neu: true } });
    const wieder = await leistungSenden(anschluss(h), leistung);
    expect(wieder).toMatchObject({ ok: true, status: 200, wert: { neu: false } });
    expect(erst.ok && wieder.ok && wieder.wert.id === erst.wert.id).toBe(true);
    expect(h.leistungen()).toHaveLength(1);
    expect(h.leistungen()[0]).toMatchObject({
      minutes: 210,
      hourlyRateCents: 8_500,
      source: "soll",
    });
  });

  it("names every failure as a value, with Haben's message", async () => {
    const h = haben();
    expect(await leistungSenden(anschluss(h, "hb_falsch"), leistung)).toMatchObject({
      ok: false,
      fehler: "zugang_abgelehnt",
    });
    expect(await leistungSenden(anschluss(h), { ...leistung, contactId: LIEFERANT })).toMatchObject(
      {
        ok: false,
        fehler: "abgelehnt",
        meldung: "Der Kontakt ist kein aktiver Kunde.",
      },
    );
    expect(await leistungSenden(anschluss(h), { ...leistung, minutes: 1_441 })).toMatchObject({
      ok: false,
      fehler: "abgelehnt",
    });
    h.rechte(["kontakte:lesen"]);
    expect(await leistungSenden(anschluss(h), leistung)).toMatchObject({ fehler: "recht_fehlt" });
    h.rechte(["leistungen:schreiben"]);
    expect(await kontakteLesen(anschluss(h))).toMatchObject({ fehler: "recht_fehlt" });
    h.stoeren("netz", 429, 503);
    expect(await leistungSenden(anschluss(h), leistung)).toMatchObject({
      fehler: "nicht_erreichbar",
    });
    expect(await leistungSenden(anschluss(h), leistung)).toMatchObject({ fehler: "zu_viele" });
    expect(await leistungSenden(anschluss(h), leistung)).toMatchObject({ fehler: "haben_fehler" });
    expect(h.leistungen()).toEqual([]);
  });

  it("calls an answer without the documented form a fault of Haben", async () => {
    const kaputt = (async () =>
      new Response("<html>Wartung</html>", { status: 200 })) as unknown as typeof fetch;
    const antwort = await leistungSenden(
      { fetch: kaputt, basis: "https://haben.test/api/v1", token: "t" },
      leistung,
    );
    expect(antwort).toMatchObject({ ok: false, fehler: "haben_fehler" });
  });
});

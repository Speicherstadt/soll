import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { entschluesseln } from "../modules/geheim/index.ts";
import {
  ELBHOF,
  HAFEN,
  HB,
  LIEFERANT,
  mitHaben,
  neuesHaben,
  zugangSetzen,
} from "./haben-testhilfen.ts";
import { anlegen, json } from "./projektzeit-testhilfen.ts";
import { baustelle } from "./stundennachweis-testhilfen.ts";

/** The link to Haben (S-606): access, contacts; the transfer is in haben-uebergabe.test.ts */

describe("the access to Haben: address and token, the token encrypted", () => {
  it("keeps the address and shows that a token is kept, never the token", async () => {
    const haben = neuesHaben();
    const w = await baustelle({ habenFetch: haben.fetch });
    expect(await json(await w.weber.anfrage(`${HB}/zugang`))).toEqual({ zugang: null });
    const gesetzt = await zugangSetzen(w.weber, haben);
    expect(gesetzt).toEqual({
      zugang: {
        adresse: "https://haben.test",
        tokenGesetzt: true,
        geaendertAm: expect.any(Number),
      },
    });
    const gelesen = await w.weber.anfrage(`${HB}/zugang`);
    expect(await gelesen.text()).not.toContain(haben.token);
  });

  it("stores the token encrypted with SOLL_SECRET_KEY, also in the audit chain", async () => {
    const haben = neuesHaben();
    const w = await baustelle({ habenFetch: haben.fetch });
    await zugangSetzen(w.weber, haben);
    const zeile = w.server.sqlite
      .query("SELECT token FROM haben_zugaenge WHERE betrieb_id = ?")
      .get(w.weber.betriebId) as { token: string };
    expect(zeile.token).not.toContain(haben.token);
    expect(
      entschluesseln(w.server.geheimerSchluessel, "haben_zugaenge:token", zeile.token),
    ).toEqual({
      ok: true,
      wert: haben.token,
    });
    const inhalte = w.server.sqlite.query("SELECT inhalt FROM audit_inhalte").all() as {
      inhalt: string;
    }[];
    expect(inhalte.some((i) => i.inhalt.includes(haben.token))).toBe(false);
    expect(kettePruefen(w.server.db, w.weber.betriebId)).toEqual([]);
  });

  it("asks for a token the first time, keeps it when only the address changes", async () => {
    const haben = neuesHaben();
    const w = await baustelle({ habenFetch: haben.fetch });
    const ohne = await w.weber.anfrage(`${HB}/zugang`, {
      method: "PUT",
      body: { adresse: haben.basis },
    });
    expect(ohne.status).toBe(422);
    expect(await json(ohne)).toEqual({ fehler: "token_fehlt" });
    await zugangSetzen(w.weber, haben);
    const neu = await w.weber.anfrage(`${HB}/zugang`, {
      method: "PUT",
      body: { adresse: `${haben.basis}/api/v1/` },
    });
    expect(neu.status).toBe(200);
    // the token is still the one kept: the contacts load
    expect((await w.weber.anfrage(`${HB}/kontakte`)).status).toBe(200);
  });

  it("refuses an address that is no web address or carries a secret", async () => {
    const w = await baustelle();
    for (const adresse of [
      "haben.test",
      "ftp://haben.test",
      "https://a:b@haben.test",
      "https://haben.test/?t=1",
    ]) {
      const antwort = await w.weber.anfrage(`${HB}/zugang`, {
        method: "PUT",
        body: { adresse, token: "hb_1" },
      });
      expect(antwort.status, adresse).toBe(400);
    }
  });

  it("lets only the owner keep or remove the access; the planner reads it, an employee nothing", async () => {
    const haben = neuesHaben();
    const w = await baustelle({ habenFetch: haben.fetch });
    const planer = await w.server.eingeladen(w.weber, "planer", "anna");
    const body = { adresse: haben.basis, token: haben.token };
    expect((await planer.anfrage(`${HB}/zugang`, { method: "PUT", body })).status).toBe(403);
    await zugangSetzen(w.weber, haben);
    expect((await planer.anfrage(`${HB}/zugang`)).status).toBe(200);
    expect((await planer.anfrage(`${HB}/zugang`, { method: "DELETE" })).status).toBe(403);
    for (const pfad of ["/zugang", "/kontakte"])
      expect((await w.sandra.anfrage(`${HB}${pfad}`)).status, pfad).toBe(403);
    expect((await w.weber.anfrage(`${HB}/zugang`, { method: "DELETE" })).status).toBe(204);
    expect(await json(await w.weber.anfrage(`${HB}/zugang`))).toEqual({ zugang: null });
    expect((await w.weber.anfrage(`${HB}/zugang`, { method: "DELETE" })).status).toBe(404);
  });
});

describe("customers from Haben (Kunden lesen)", () => {
  it("lists the contacts of Haben with the customer each is linked to", async () => {
    const w = await mitHaben();
    const kontakte = (await json(await w.weber.anfrage(`${HB}/kontakte`))).kontakte;
    expect(kontakte).toEqual([
      {
        id: ELBHOF,
        name: "Elbhof Immobilien GmbH",
        kundennummer: "K-1001",
        kundeId: w.kunde.kundeId,
      },
      { id: LIEFERANT, name: "Großhandel Nord", kundennummer: null, kundeId: null },
      { id: HAFEN, name: "Hafenfest e. V.", kundennummer: "K-2001", kundeId: null },
    ]);
  });

  it("takes a contact over as a new customer with its name, number and reference", async () => {
    const w = await mitHaben();
    const antwort = await w.weber.anfrage(`${HB}/kontakte/${HAFEN}`, { body: {} });
    expect(antwort.status).toBe(201);
    expect(await json(antwort)).toMatchObject({
      name: "Hafenfest e. V.",
      nummer: "K-2001",
      externQuelle: "haben",
      externId: HAFEN,
    });
    // a second time it is refused: one customer per contact
    expect((await w.weber.anfrage(`${HB}/kontakte/${HAFEN}`, { body: {} })).status).toBe(409);
  });

  it("links an existing customer, refuses an unknown contact or customer", async () => {
    const w = await mitHaben({ verbunden: false });
    await zugangSetzen(w.weber, w.haben);
    const unbekannt = await w.weber.anfrage(`${HB}/kontakte/${crypto.randomUUID()}`, {
      body: { kundeId: w.kunde.kundeId },
    });
    expect(unbekannt.status).toBe(422);
    expect(await json(unbekannt)).toEqual({ fehler: "kontakt_unbekannt" });
    const fremd = await w.weber.anfrage(`${HB}/kontakte/${ELBHOF}`, { body: { kundeId: "nein" } });
    expect(fremd.status).toBe(404);
    const ok = await w.weber.anfrage(`${HB}/kontakte/${ELBHOF}`, {
      body: { kundeId: w.kunde.kundeId },
    });
    expect(await json(ok)).toMatchObject({ kundeId: w.kunde.kundeId, externId: ELBHOF });
    const zweiter = await anlegen(w.weber, "/kunden", { name: "Elbhof Verwaltung" });
    const doppelt = await w.weber.anfrage(`${HB}/kontakte/${ELBHOF}`, {
      body: { kundeId: zweiter.kundeId },
    });
    expect(doppelt.status).toBe(409);
  });

  it("says why Haben cannot be read: no access, a refused token, no answer", async () => {
    const w = await mitHaben({ verbunden: false });
    const ohne = await w.weber.anfrage(`${HB}/kontakte`);
    expect([ohne.status, await json(ohne)]).toEqual([409, { fehler: "haben_fehlt" }]);
    await w.weber.anfrage(`${HB}/zugang`, {
      method: "PUT",
      body: { adresse: w.haben.basis, token: "hb_widerrufen" },
    });
    const falsch = await w.weber.anfrage(`${HB}/kontakte`);
    expect(falsch.status).toBe(502);
    expect(await json(falsch)).toEqual({
      fehler: "zugang_abgelehnt",
      meldung: "Kein gültiges Token.",
    });
    await zugangSetzen(w.weber, w.haben);
    w.haben.stoeren("netz");
    expect(await json(await w.weber.anfrage(`${HB}/kontakte`))).toEqual({
      fehler: "nicht_erreichbar",
      meldung: "",
    });
  });
});

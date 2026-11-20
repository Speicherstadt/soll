import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { json, mitgliedId, mitToken, tokenVon, weberMitSandra } from "./zugaenge-testhilfen.ts";

const TAG_MS = 24 * 60 * 60 * 1000;

describe("personal access tokens (S-607)", () => {
  it("are created in the settings, shown once, listed without the token, in the chain", async () => {
    const { server, sandra } = await weberMitSandra();
    const neu = await sandra.anfrage("/api/v1/zugaenge", {
      body: { name: "Tabelle", gueltigTage: 90 },
    });
    expect(neu.status).toBe(201);
    const { token, zugang } = (await neu.json()) as {
      token: string;
      zugang: Record<string, unknown>;
    };
    expect(token).toMatch(/^soll_/);
    expect(zugang).toEqual({
      zugangId: expect.any(String),
      name: "Tabelle",
      praefix: token.slice(0, 9),
      angelegtAm: server.jetzt(),
      gueltigBis: server.jetzt() + 90 * TAG_MS,
      zuletztGenutzt: null,
    });
    const liste = await json(await sandra.anfrage("/api/v1/zugaenge"));
    expect(liste).toEqual({ zugaenge: [zugang] });
    expect(JSON.stringify(liste)).not.toContain(token);
    const link = server.sqlite
      .query("SELECT akteur, aktion FROM audit_glieder WHERE tabelle = 'apiZugaenge'")
      .all();
    expect(link).toEqual([{ akteur: sandra.nutzerId, aktion: "einfuegen" }]);
  });

  it("refuses a name that is empty or too long and an expiry it does not offer", async () => {
    const { sandra } = await weberMitSandra();
    for (const body of [
      { name: " ", gueltigTage: null },
      { name: "x".repeat(101), gueltigTage: null },
      { name: "a", gueltigTage: 7 },
      { name: "a", gueltigTage: null, rolle: "inhaber" },
    ]) {
      const antwort = await sandra.anfrage("/api/v1/zugaenge", { body });
      expect(antwort.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("call /api/v1 with the rights of the person's role, as Bearer beside the session", async () => {
    const { server, sandra } = await weberMitSandra();
    const { token } = await tokenVon(sandra);
    const api = mitToken(server, token);
    const betrieb = await api("/api/v1/betrieb");
    expect(betrieb.status).toBe(200);
    expect(await json(betrieb)).toMatchObject({ name: "Weber Haustechnik", rolle: "mitarbeiter" });
    expect((await api("/api/v1/arbeitszeit/tag")).status).toBe(200);
    // a fitter does not see everyone's times, with a token neither
    expect(await json(await api("/api/v1/arbeitszeit/personen"))).toEqual({
      fehler: "keine_berechtigung",
    });
  });

  it("follow a change of role at the next call", async () => {
    const { server, jonas, sandra } = await weberMitSandra();
    const { token } = await tokenVon(sandra);
    const api = mitToken(server, token);
    expect((await api("/api/v1/arbeitszeit/personen")).status).toBe(403);
    const wechsel = await jonas.anfrage("/api/auth/organization/update-member-role", {
      body: {
        memberId: await mitgliedId(jonas, sandra.nutzerId),
        role: "planer",
        organizationId: jonas.betriebId,
      },
    });
    expect(wechsel.status).toBe(200);
    expect((await api("/api/v1/arbeitszeit/personen")).status).toBe(200);
  });

  it("die when the person leaves and stay dead after she joins again", async () => {
    const { server, jonas, sandra } = await weberMitSandra();
    const { token } = await tokenVon(sandra);
    const api = mitToken(server, token);
    const weg = await jonas.anfrage("/api/auth/organization/remove-member", {
      body: {
        memberIdOrEmail: await mitgliedId(jonas, sandra.nutzerId),
        organizationId: jonas.betriebId,
      },
    });
    expect(weg.status).toBe(200);
    expect((await api("/api/v1/betrieb")).status).toBe(403);
    server.stelleUhr(server.jetzt() + 1000);
    await server.auth.mitgliedHinzufuegen({
      nutzerId: sandra.nutzerId,
      betriebId: jonas.betriebId,
      rolle: "mitarbeiter",
    });
    expect((await sandra.anfrage("/api/v1/betrieb")).status).toBe(200);
    const wieder = await api("/api/v1/betrieb");
    expect(wieder.status).toBe(401);
    expect(await json(wieder)).toEqual({ fehler: "zugang_ungueltig" });
  });

  it("answer 401 with WWW-Authenticate when unknown, revoked or expired", async () => {
    const { server, jonas, sandra } = await weberMitSandra();
    const kurz = await tokenVon(sandra, { gueltigTage: 30 });
    const lang = await tokenVon(sandra);
    const unbekannt = await mitToken(server, "soll_nichtda")("/api/v1/betrieb");
    expect(unbekannt.status).toBe(401);
    expect(unbekannt.headers.get("www-authenticate")).toBe('Bearer error="invalid_token"');
    const weg = await sandra.anfrage(`/api/v1/zugaenge/${lang.zugang.zugangId}`, {
      method: "DELETE",
    });
    expect(weg.status).toBe(200);
    expect((await mitToken(server, lang.token)("/api/v1/betrieb")).status).toBe(401);
    expect((await mitToken(server, kurz.token)("/api/v1/betrieb")).status).toBe(200);
    server.stelleUhr(server.jetzt() + 30 * TAG_MS);
    const abgelaufen = await mitToken(server, kurz.token)("/api/v1/betrieb");
    expect(abgelaufen.status).toBe(401);
    expect(await json(abgelaufen)).toEqual({ fehler: "zugang_abgelaufen" });
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
  });

  it("never fall back to the session when the token is wrong", async () => {
    const { server, sandra } = await weberMitSandra();
    const antwort = await server.app.request("http://localhost:28200/api/v1/betrieb", {
      headers: { authorization: "Bearer soll_falsch", cookie: "" },
    });
    expect(antwort.status).toBe(401);
    expect((await sandra.anfrage("/api/v1/betrieb")).status).toBe(200);
  });

  it("are managed only with a session, never with a token", async () => {
    const { server, sandra } = await weberMitSandra();
    const { token, zugang } = await tokenVon(sandra);
    const api = mitToken(server, token);
    for (const [method, pfad, body] of [
      ["GET", "/api/v1/zugaenge", undefined],
      ["POST", "/api/v1/zugaenge", { name: "mehr", gueltigTage: null }],
      ["DELETE", `/api/v1/zugaenge/${zugang.zugangId}`, undefined],
    ] as const) {
      const antwort = await api(pfad, { method, body });
      expect(antwort.status, `${method} ${pfad}`).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "nur_sitzung" });
    }
  });

  it("are not for the terminal's device", async () => {
    const { server, jonas } = await weberMitSandra();
    const terminal = await server.eingeladen(jonas, "geraet", "terminal");
    const antwort = await terminal.anfrage("/api/v1/zugaenge", {
      body: { name: "x", gueltigTage: null },
    });
    expect(antwort.status).toBe(403);
    expect((await terminal.anfrage("/api/v1/zugaenge")).status).toBe(403);
  });

  it("stamp with the source api", async () => {
    const { server, sandra } = await weberMitSandra();
    const { token } = await tokenVon(sandra);
    const antwort = await mitToken(server, token)("/api/v1/arbeitszeit/stempelungen", {
      body: { art: "kommen" },
    });
    expect(antwort.status).toBe(201);
    expect(await json(antwort)).toMatchObject({ art: "kommen", quelle: "api" });
  });

  it("remember the day of the last use with one link a day", async () => {
    const { server, sandra } = await weberMitSandra();
    const { token } = await tokenVon(sandra);
    const api = mitToken(server, token);
    await api("/api/v1/betrieb");
    await api("/api/v1/betrieb");
    const links = () =>
      server.sqlite
        .query("SELECT aktion FROM audit_glieder WHERE tabelle = 'apiZugaenge' ORDER BY seq")
        .all();
    expect(links()).toEqual([{ aktion: "einfuegen" }, { aktion: "aendern" }]);
    const liste = await json(await sandra.anfrage("/api/v1/zugaenge"));
    expect((liste.zugaenge as { zuletztGenutzt: string }[])[0]?.zuletztGenutzt).toBe("2026-09-21");
  });

  it("are limited to 120 calls a minute, then 429 with Retry-After", async () => {
    const { server, sandra } = await weberMitSandra();
    const { token } = await tokenVon(sandra);
    const api = mitToken(server, token);
    for (let i = 0; i < 120; i++) expect((await api("/api/v1/betrieb")).status).toBe(200);
    const zuViele = await api("/api/v1/betrieb");
    expect(zuViele.status).toBe(429);
    expect(zuViele.headers.get("retry-after")).toBe("60");
    expect(await json(zuViele)).toEqual({ fehler: "zu_viele_anfragen" });
    // the session of the same person is not limited by her token
    expect((await sandra.anfrage("/api/v1/betrieb")).status).toBe(200);
    server.stelleUhr(server.jetzt() + 60_000);
    expect((await api("/api/v1/betrieb")).status).toBe(200);
  });

  it("stand in the person's Auskunft without hash or start, not in the owner's copy", async () => {
    const { server, jonas, sandra } = await weberMitSandra();
    const { token } = await tokenVon(sandra, { name: "Tabelle" });
    const eigene = await json(await sandra.anfrage("/api/v1/auskunft"));
    expect(eigene.zugaenge).toEqual([
      {
        zugangId: expect.any(String),
        name: "Tabelle",
        angelegtAm: new Date(server.jetzt()).toISOString(),
        gueltigBis: null,
        zuletztGenutzt: null,
      },
    ]);
    expect(JSON.stringify(eigene)).not.toContain(token.slice(0, 9));
    const kette = eigene.auditKette as { zuDeinenDaten: { tabelle: string }[] };
    expect(kette.zuDeinenDaten.some((g) => g.tabelle === "apiZugaenge")).toBe(true);
    const kopie = await json(await jonas.anfrage(`/api/v1/auskunft?nutzerId=${sandra.nutzerId}`));
    expect(kopie.zugaenge).toBeUndefined();
    expect(JSON.stringify(kopie)).not.toContain("apiZugaenge");
  });
});

import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { ELBHOF, HB, LIEFERANT, liste, mitHaben, uebergeben } from "./haben-testhilfen.ts";
import { anlegen, json, PZ } from "./projektzeit-testhilfen.ts";
import { buchen, starten, um } from "./stoppuhr-testhilfen.ts";
import { tageFrage, unterschreiben } from "./stundennachweis-testhilfen.ts";

/**
 * The transfer of bookings to Haben as Leistungen (S-606), against the stand-in built from Haben's
 * docs/api.md: POST /leistungen with source and externalId, repeatable, and its failures
 */

const ids = (w: Awaited<ReturnType<typeof mitHaben>>) => [
  w.sandraMontage.buchungId as string,
  w.jonasFahrt.buchungId as string,
];

const POSTS = (w: Awaited<ReturnType<typeof mitHaben>>) =>
  w.haben.anfragen().filter((a) => a.methode === "POST").length;

describe("bookings go to Haben as Leistungen (docs/api.md, POST /leistungen)", () => {
  it("bills the bookings and sends each with source, externalId, day, minutes, text and order", async () => {
    const w = await mitHaben();
    await anlegen(w.weber, "/saetze", {
      kundeId: null,
      projektId: null,
      taetigkeitId: w.montage.taetigkeitId,
      nutzerId: null,
      gueltigAb: "2026-01-01",
      centProStunde: 8_500,
    });
    const antwort = await uebergeben(w.weber, ids(w));
    expect(antwort.status).toBe(200);
    const { buchungen } = await json(antwort);
    expect(buchungen).toEqual([
      expect.objectContaining({
        buchungId: w.sandraMontage.buchungId,
        stand: "gesendet",
        fehler: null,
      }),
      expect.objectContaining({
        buchungId: w.jonasFahrt.buchungId,
        stand: "gesendet",
        fehler: null,
      }),
    ]);
    expect(
      w.haben
        .anfragen()
        .filter((a) => a.methode === "POST")
        .map((a) => a.koerper),
    ).toEqual([
      {
        contactId: ELBHOF,
        workedOn: "2026-11-20",
        minutes: 210,
        description: "Montage: Vorwand gesetzt",
        hourlyRateCents: 8_500,
        nonBillable: false,
        project: "Bad Elbhof",
        source: "soll",
        externalId: w.sandraMontage.buchungId,
      },
      {
        contactId: ELBHOF,
        workedOn: "2026-11-20",
        minutes: 45,
        description: "Fahrt",
        nonBillable: true,
        project: "Bad Elbhof",
        source: "soll",
        externalId: w.jonasFahrt.buchungId,
      },
    ]);
    expect(w.haben.leistungen().map((l) => l.id)).toEqual(
      (buchungen as { leistungId: string }[]).map((b) => b.leistungId),
    );
    expect(kettePruefen(w.server.db, w.weber.betriebId)).toEqual([]);
  });

  it("without a rate in Soll Haben takes the customer's: Soll guesses no amount", async () => {
    const w = await mitHaben();
    await uebergeben(w.weber, [w.sandraMontage.buchungId]);
    const [montage] = w.haben.anfragen().filter((a) => a.methode === "POST");
    expect(montage?.koerper).not.toHaveProperty("hourlyRateCents");
    expect(w.haben.leistungen()[0]?.hourlyRateCents).toBe(7_000);
  });

  it("locks what it sent: a booking handed over is billed and cannot change", async () => {
    const w = await mitHaben();
    await uebergeben(w.weber, ids(w));
    const aendern = await w.weber.anfrage(`${PZ}/buchungen/${w.sandraMontage.buchungId}`, {
      method: "PATCH",
      body: { notiz: "doch anders" },
    });
    expect([aendern.status, await json(aendern)]).toEqual([409, { fehler: "abgerechnet" }]);
    const loeschen = await w.weber.anfrage(`${PZ}/buchungen/${w.jonasFahrt.buchungId}`, {
      method: "DELETE",
    });
    expect(loeschen.status).toBe(409);
  });

  it("a repeat sends nothing twice: no second entry in Haben, no call for what Haben confirmed", async () => {
    const w = await mitHaben();
    const erst = await json(await uebergeben(w.weber, ids(w)));
    const anfragen = POSTS(w);
    const wieder = await json(await uebergeben(w.weber, ids(w)));
    expect(wieder).toEqual(erst);
    expect(POSTS(w)).toBe(anfragen);
    expect(w.haben.leistungen()).toHaveLength(2);
  });

  it("names the signed Stundennachweis in the text", async () => {
    const w = await mitHaben();
    await unterschreiben(w.weber, tageFrage(w.projekt.projektId));
    await uebergeben(w.weber, [w.sandraMontage.buchungId]);
    expect(w.haben.leistungen()[0]?.description).toBe(
      "Montage: Vorwand gesetzt (Stundennachweis Nr. 1)",
    );
  });
});

describe("failures of Haben: nothing is lost, nothing doubled", () => {
  it("without an answer the bookings wait, billed, and the next transfer sends them", async () => {
    const w = await mitHaben();
    w.haben.stoeren("netz");
    const erst = (await json(await uebergeben(w.weber, ids(w)))).buchungen;
    expect(erst).toEqual([
      expect.objectContaining({ stand: "wartet", fehler: "nicht_erreichbar", leistungId: null }),
      expect.objectContaining({ stand: "wartet", fehler: null }),
    ]);
    // it stopped at the first: the second was not tried while Haben did not answer
    expect(POSTS(w)).toBe(1);
    expect(w.haben.leistungen()).toEqual([]);
    const wieder = (await json(await uebergeben(w.weber, ids(w)))).buchungen as { stand: string }[];
    expect(wieder.map((b) => b.stand)).toEqual(["gesendet", "gesendet"]);
    expect(w.haben.leistungen()).toHaveLength(2);
  });

  it("an answer lost on its way back: the retry finds the entry Haben already has (200)", async () => {
    let verlieren = true;
    const w = await mitHaben({
      holen: (haben) =>
        (async (eingabe: RequestInfo | URL, init?: RequestInit) => {
          const antwort = await haben.fetch(eingabe, init);
          if (verlieren && init?.method === "POST") {
            verlieren = false;
            throw new TypeError("connection reset");
          }
          return antwort;
        }) as typeof fetch,
    });
    await uebergeben(w.weber, ids(w));
    expect(w.haben.leistungen()).toHaveLength(1);
    const wieder = (await json(await uebergeben(w.weber, ids(w)))).buchungen as {
      stand: string;
      leistungId: string;
    }[];
    expect(wieder.map((b) => b.stand)).toEqual(["gesendet", "gesendet"]);
    expect(w.haben.leistungen()).toHaveLength(2);
    expect(wieder[0]?.leistungId).toBe(w.haben.leistungen()[0]?.id);
  });

  it("stops at a refused token, too many calls or a fault of Haben, and says so", async () => {
    for (const stoerung of [401, 403, 429, 503] as const) {
      const w = await mitHaben();
      w.haben.stoeren(stoerung);
      const { buchungen } = await json(await uebergeben(w.weber, ids(w)));
      const erwartet = {
        401: "zugang_abgelehnt",
        403: "recht_fehlt",
        429: "zu_viele",
        503: "haben_fehler",
      };
      expect(buchungen, String(stoerung)).toEqual([
        expect.objectContaining({ stand: "wartet", fehler: erwartet[stoerung] }),
        expect.objectContaining({ stand: "wartet", fehler: null }),
      ]);
      expect(POSTS(w), String(stoerung)).toBe(1);
    }
  });

  it("goes on past an entry Haben refuses, keeps Haben's message, and sends after a fix", async () => {
    const w = await mitHaben();
    // linked by mistake to a supplier: Haben refuses each entry (422), Soll tries every one
    await w.weber.anfrage(`${HB}/kontakte/${LIEFERANT}`, { body: { kundeId: w.kunde.kundeId } });
    const { buchungen } = await json(await uebergeben(w.weber, ids(w)));
    expect(buchungen).toEqual([
      expect.objectContaining({
        stand: "wartet",
        fehler: "abgelehnt",
        meldung: "Der Kontakt ist kein aktiver Kunde.",
      }),
      expect.objectContaining({ stand: "wartet", fehler: "abgelehnt" }),
    ]);
    expect(POSTS(w)).toBe(2);
    await w.weber.anfrage(`${HB}/kontakte/${ELBHOF}`, { body: { kundeId: w.kunde.kundeId } });
    const wieder = (await json(await uebergeben(w.weber, ids(w)))).buchungen as { stand: string }[];
    expect(wieder.map((b) => b.stand)).toEqual(["gesendet", "gesendet"]);
    expect(w.haben.leistungen().map((l) => l.contactId)).toEqual([ELBHOF, ELBHOF]);
  });
});

describe("what does not go to Haben", () => {
  it("nothing without an access or a linked customer, and nothing is billed then", async () => {
    const ohneZugang = await mitHaben({ verbunden: false });
    const a = await uebergeben(ohneZugang.weber, ids(ohneZugang));
    expect([a.status, await json(a)]).toEqual([409, { fehler: "haben_fehlt" }]);
    const ohneKunde = await mitHaben({ verbunden: false });
    await ohneKunde.weber.anfrage(`${HB}/zugang`, {
      method: "PUT",
      body: { adresse: ohneKunde.haben.basis, token: ohneKunde.haben.token },
    });
    const b = await uebergeben(ohneKunde.weber, ids(ohneKunde));
    expect([b.status, await json(b)]).toEqual([422, { fehler: "kunde_ohne_haben" }]);
    // still open: they can change
    const aendern = await ohneKunde.weber.anfrage(
      `${PZ}/buchungen/${ohneKunde.jonasFahrt.buchungId}`,
      {
        method: "PATCH",
        body: { notiz: "über die Köhlbrandbrücke" },
      },
    );
    expect(aendern.status).toBe(200);
    expect(ohneKunde.haben.anfragen()).toEqual([]);
  });

  it("a booking billed by hand is not sent: it was billed outside Haben", async () => {
    const w = await mitHaben();
    await w.weber.anfrage(`${PZ}/buchungen/abrechnen`, {
      body: { buchungIds: [w.jonasFahrt.buchungId] },
    });
    const antwort = await uebergeben(w.weber, ids(w));
    expect([antwort.status, await json(antwort)]).toEqual([409, { fehler: "abgerechnet" }]);
    expect(POSTS(w)).toBe(0);
    // all or none: Sandra's booking stays open
    const offen = (await json(await liste(w.weber, w.projekt.projektId))).buchungen as {
      stand: string;
    }[];
    expect(offen.map((b) => b.stand)).toEqual(["offen", "offen", "abgerechnet"]);
  });

  it("refuses internal time, a running or unknown booking and more than 100 at once", async () => {
    const w = await mitHaben();
    const intern = await buchen(w.sandra, {
      projektId: null,
      taetigkeitId: "lager",
      beginn: um("15:00"),
      ende: um("16:00"),
    });
    const a = await uebergeben(w.weber, [intern.buchungId]);
    expect([a.status, await json(a)]).toEqual([422, { fehler: "ohne_auftrag" }]);
    await starten(w.sandra, {
      projektId: w.projekt.projektId,
      taetigkeitId: w.montage.taetigkeitId,
    });
    const laufend = (await json(await w.sandra.anfrage(`${PZ}/stoppuhr`))).laufend as {
      buchungId: string;
    };
    expect((await uebergeben(w.weber, [laufend.buchungId])).status).toBe(409);
    expect((await uebergeben(w.weber, ["unbekannt"])).status).toBe(404);
    expect(
      (
        await uebergeben(
          w.weber,
          Array.from({ length: 101 }, (_, i) => `b${i}`),
        )
      ).status,
    ).toBe(400);
    expect((await uebergeben(w.weber, [])).status).toBe(400);
    expect(POSTS(w)).toBe(0);
  });

  it("is for owner and planner: an employee hands nothing over", async () => {
    const w = await mitHaben();
    expect((await uebergeben(w.sandra, ids(w))).status).toBe(403);
    expect((await liste(w.sandra, w.projekt.projektId)).status).toBe(403);
    const planer = await w.server.eingeladen(w.weber, "planer", "anna");
    expect((await uebergeben(planer, ids(w))).status).toBe(200);
  });
});

describe("the bookings of an order with their state towards Haben", () => {
  it("lists the finished bookings of the span with state, contact and what each is", async () => {
    const w = await mitHaben();
    await uebergeben(w.weber, [w.sandraMontage.buchungId]);
    const antwort = await json(await liste(w.weber, w.projekt.projektId));
    expect(antwort.kontaktId).toBe(ELBHOF);
    expect(antwort.buchungen).toEqual([
      expect.objectContaining({
        tag: "2026-11-18",
        stand: "offen",
        minuten: 60,
        taetigkeit: "Montage",
      }),
      expect.objectContaining({
        tag: "2026-11-20",
        stand: "gesendet",
        minuten: 210,
        person: "sandra",
        notiz: "Vorwand gesetzt",
        abrechenbar: true,
      }),
      expect.objectContaining({
        stand: "offen",
        minuten: 45,
        taetigkeit: "Fahrt",
        abrechenbar: false,
      }),
    ]);
  });

  it("says when the customer is not linked, and refuses an unknown order or a wrong span", async () => {
    const w = await mitHaben({ verbunden: false });
    expect((await json(await liste(w.weber, w.projekt.projektId))).kontaktId).toBeNull();
    expect((await liste(w.weber, "unbekannt")).status).toBe(422);
    const falsch = await w.weber.anfrage(
      `${HB}/buchungen?projektId=${w.projekt.projektId}&von=2026-11-30&bis=2026-11-01`,
    );
    expect(falsch.status).toBe(400);
  });
});

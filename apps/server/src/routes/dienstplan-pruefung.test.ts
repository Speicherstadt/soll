import { describe, expect, it } from "vitest";
import { elbblick, json, schichtVon } from "./dienstplan-testhilfen.ts";

/*
 * The findings of the rules on the plan (S-502). The test clock stands on Monday 21 September 2026,
 * so the week of 23 November lies ahead.
 */

type Befund = { regel: string; art: string; nutzerId: string; schichtIds: string[] };

const planen = async (
  person: {
    anfrage: (pfad: string, init?: { method?: string; body?: unknown }) => Promise<Response>;
  },
  schicht: Record<string, unknown>,
) => {
  const antwort = await person.anfrage("/api/v1/dienstplan/schichten", { body: schicht });
  expect(antwort.status).toBe(201);
  return (await antwort.json()) as { schichtId: string };
};

const befundeDer = async (
  person: { anfrage: (pfad: string) => Promise<Response> },
  standortId: string,
  tag: string,
) =>
  (await json(await person.anfrage(`/api/v1/dienstplan/woche?standortId=${standortId}&tag=${tag}`)))
    .befunde as Befund[] | null;

const regeln = (befunde: Befund[] | null) => (befunde ?? []).map((b) => b.regel);

describe("findings in the plan (S-502)", () => {
  it("warns at a shift over 10 hours and still saves it", async () => {
    const { lea, tom, standortId } = await elbblick();
    const lang = await planen(lea, {
      ...schichtVon(standortId, tom.nutzerId, "2026-11-24"),
      beginnMinute: 6 * 60,
      endeMinute: 17 * 60 + 30,
      pauseMinuten: 45,
    });
    expect(await befundeDer(lea, standortId, "2026-11-24")).toEqual([
      expect.objectContaining({
        regel: "R-02",
        norm: "§ 3 Satz 2 ArbZG",
        schwere: "verstoss",
        art: "ueber_10h",
        nutzerId: tom.nutzerId,
        schichtIds: [lang.schichtId],
      }),
    ]);
  });

  it("shows findings only to whoever plans", async () => {
    const { lea, tom, standortId } = await elbblick();
    await planen(lea, { ...schichtVon(standortId, tom.nutzerId), endeMinute: 23 * 60 + 59 });
    expect(await befundeDer(tom, standortId, "2026-11-23")).toBeNull();
  });

  it("has nothing to say about a week that lies before today", async () => {
    const { lea, tom, standortId } = await elbblick();
    await planen(lea, {
      ...schichtVon(standortId, tom.nutzerId, "2026-09-15"),
      beginnMinute: 6 * 60,
      endeMinute: 18 * 60,
    });
    expect(await befundeDer(lea, standortId, "2026-09-15")).toEqual([]);
  });

  it("reads the exception of § 10 Abs. 1 ArbZG from the settings of the business", async () => {
    const { mia, lea, tom, standortId } = await elbblick();
    await planen(lea, schichtVon(standortId, tom.nutzerId, "2026-11-29"));
    expect(regeln(await befundeDer(lea, standortId, "2026-11-29"))).toContain("R-07");
    const einstellungen = {
      branche: "gastronomie_beherbergung",
      sonntagsausnahme: 4,
      ausgleichszeitraum: null,
      ausgleichBeginn: null,
    };
    expect(
      (await lea.anfrage("/api/v1/betrieb/pruefung", { method: "PUT", body: einstellungen }))
        .status,
    ).toBe(403);
    const gesetzt = await mia.anfrage("/api/v1/betrieb/pruefung", {
      method: "PUT",
      body: einstellungen,
    });
    expect(await json(gesetzt)).toEqual(einstellungen);
    expect(await json(await lea.anfrage("/api/v1/betrieb/pruefung"))).toEqual(einstellungen);
    expect(regeln(await befundeDer(lea, standortId, "2026-11-29"))).not.toContain("R-07");
  });

  it("refuses settings outside the law's numbers", async () => {
    const { mia } = await elbblick();
    const falsch = {
      branche: "zirkus",
      sonntagsausnahme: 17,
      ausgleichszeitraum: null,
      ausgleichBeginn: null,
    };
    const antwort = await mia.anfrage("/api/v1/betrieb/pruefung", { method: "PUT", body: falsch });
    expect(antwort.status).toBe(400);
  });

  it("applies the JArbSchG with the birth date only the owner enters", async () => {
    const { mia, lea, tom, standortId } = await elbblick();
    await planen(lea, {
      ...schichtVon(standortId, tom.nutzerId, "2026-11-24"),
      beginnMinute: 7 * 60,
      endeMinute: 16 * 60 + 30,
      pauseMinuten: 60,
    });
    expect(regeln(await befundeDer(lea, standortId, "2026-11-24"))).not.toContain("R-15");
    const angaben = {
      geburtsdatum: "2009-06-01",
      wechselschicht: false,
      abruf: false,
      mutterschutz: [],
    };
    const pfad = `/api/v1/personen/${tom.nutzerId}/angaben`;
    expect((await lea.anfrage(pfad, { method: "PUT", body: angaben })).status).toBe(403);
    expect((await lea.anfrage(pfad)).status).toBe(403);
    expect((await tom.anfrage(pfad)).status).toBe(403);
    expect(await json(await mia.anfrage(pfad, { method: "PUT", body: angaben }))).toEqual(angaben);
    expect(await json(await mia.anfrage(pfad))).toEqual(angaben);
    expect(regeln(await befundeDer(lea, standortId, "2026-11-24"))).toContain("R-15");
  });

  it("refuses a span of the Mutterschutz that ends before it begins", async () => {
    const { mia, tom } = await elbblick();
    const antwort = await mia.anfrage(`/api/v1/personen/${tom.nutzerId}/angaben`, {
      method: "PUT",
      body: {
        geburtsdatum: null,
        wechselschicht: false,
        abruf: false,
        mutterschutz: [{ von: "2026-11-02", bis: "2026-11-01" }],
      },
    });
    expect(antwort.status).toBe(400);
  });

  it("reads the end of last night's stamped shift, stamped this morning (§ 5 ArbZG)", async () => {
    const { server, lea, tom, standortId } = await elbblick();
    const um = (text: string) => Date.parse(`${text}+01:00`);
    server.stelleUhr(um("2026-11-23T10:00:00"));
    for (const [art, zeitpunkt] of [
      ["kommen", um("2026-11-22T22:00:00")],
      ["gehen", um("2026-11-23T06:00:00")],
    ] as const) {
      const antwort = await tom.anfrage("/api/v1/arbeitszeit/stempelungen/nachtrag", {
        body: { art, zeitpunkt, grund: "vergessen" },
      });
      expect(antwort.status).toBe(201);
    }
    const spaet = await planen(lea, {
      ...schichtVon(standortId, tom.nutzerId, "2026-11-23"),
      beginnMinute: 15 * 60 + 30,
      endeMinute: 21 * 60,
      pauseMinuten: 0,
    });
    expect(await befundeDer(lea, standortId, "2026-11-23")).toContainEqual(
      expect.objectContaining({ regel: "R-05", schichtIds: [spaet.schichtId] }),
    );
  });

  it("names a draft of tomorrow for a person on call (§ 12 TzBfG)", async () => {
    const { mia, lea, tom, standortId } = await elbblick();
    await mia.anfrage(`/api/v1/personen/${tom.nutzerId}/angaben`, {
      method: "PUT",
      body: { geburtsdatum: null, wechselschicht: false, abruf: true, mutterschutz: [] },
    });
    const morgen = await planen(lea, schichtVon(standortId, tom.nutzerId, "2026-09-22"));
    expect(await befundeDer(lea, standortId, "2026-09-22")).toEqual([
      expect.objectContaining({ regel: "R-22", art: "vorlauf", schichtIds: [morgen.schichtId] }),
    ]);
  });
});

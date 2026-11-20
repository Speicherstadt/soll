import { pdfText } from "@soll/export";
import { describe, expect, it } from "vitest";
import { abgeschlossen, json, nachtrag, type Person, um, weber } from "./monat-testhilfen.ts";

const pfad = (abfrage: string) => `/api/v1/arbeitszeit/pruefexport?${abfrage}`;
const csv = async (wer: Person, abfrage: string) => {
  const antwort = await wer.anfrage(pfad(`format=csv&${abfrage}`));
  return { antwort, text: antwort.ok ? await antwort.text() : "" };
};

describe("GET /api/v1/arbeitszeit/pruefexport", () => {
  it("gives Sandra's October as CSV with the Prüfwert of the closed month", async () => {
    const { jonas, sandra, pruefwert } = await abgeschlossen();
    const { antwort, text } = await csv(
      jonas,
      `von=2026-10-01&bis=2026-11-30&nutzerId=${sandra.nutzerId}`,
    );
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(antwort.headers.get("content-disposition")).toBe(
      'attachment; filename="pruefexport-2026-10-01-2026-11-30.csv"',
    );
    const zeilen = text.split("\r\n");
    expect(zeilen[0]?.startsWith("﻿Person;Datum;Beginn;Ende;")).toBe(true);
    const sechster = zeilen.find((z) => z.includes(";06.10.2026;")) ?? "";
    expect(sechster).toMatch(/^sandra;06\.10\.2026;08:00;16:30;30;480;20\.11\.2026 09:00;/);
    expect(sechster).toContain(
      "nachgetragen am 20.11.2026 09:00 von sandra: Kommen 08:00, Grund: Zettel",
    );
    expect(sechster.endsWith(`;${pruefwert}`)).toBe(true);
    const nacht = zeilen.find((z) => z.includes(";31.10.2026;")) ?? "";
    expect(nacht).toContain(";20:00;01.11.2026 02:00;0;360;");
    // the change to the Gehen after midnight belongs to the working day the shift began on
    expect(nacht).toContain("Gehen 02:00, Grund: Zettel");
    expect(zeilen.filter((z) => z.startsWith("sandra;"))).toHaveLength(2);
  });

  it("gives the same days as a PDF", async () => {
    const { jonas, sandra, pruefwert } = await abgeschlossen();
    const antwort = await jonas.anfrage(
      pfad(`format=pdf&von=2026-10-01&bis=2026-10-31&nutzerId=${sandra.nutzerId}`),
    );
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("content-type")).toBe("application/pdf");
    const text = pdfText(new Uint8Array(await antwort.arrayBuffer()));
    expect(text).toContain("Prüfexport 01.10.2026 bis 31.10.2026");
    expect(text).toContain("sandra · Weber Haustechnik");
    expect(text).toContain(
      `Oktober 2026: abgeschlossen am 20.11.2026 09:00, Prüfwert ${pruefwert}`,
    );
  });

  it("lets a person export their own days, and only those", async () => {
    const { sandra, jonas } = await weber();
    const eigen = await csv(sandra, "von=2026-10-01&bis=2026-10-31");
    expect(eigen.antwort.status).toBe(200);
    expect(eigen.text).toContain("sandra;06.10.2026;");
    const fremd = await csv(sandra, `von=2026-10-01&bis=2026-10-31&nutzerId=${jonas.nutzerId}`);
    expect(fremd.antwort.status).toBe(403);
  });

  it("takes several people at once for whoever may see all times, payroll included", async () => {
    const { lohn, sandra, jonas } = await weber();
    await nachtrag(jonas, {
      art: "kommen",
      zeitpunkt: um("2026-10-07T07:00:00+02:00"),
      grund: "x",
    });
    await nachtrag(jonas, { art: "gehen", zeitpunkt: um("2026-10-07T15:00:00+02:00"), grund: "x" });
    const { antwort, text } = await csv(
      lohn,
      `von=2026-10-01&bis=2026-10-31&nutzerId=${sandra.nutzerId}&nutzerId=${jonas.nutzerId}`,
    );
    expect(antwort.status).toBe(200);
    expect(text).toContain("\r\nsandra;06.10.2026;");
    expect(text).toContain("\r\nInhaber Weber Haustechnik;07.10.2026;07:00;15:00;");
  });

  it("refuses a period that is wrong, reversed or longer than two years, and a wrong format", async () => {
    const { sandra } = await weber();
    for (const abfrage of [
      "format=csv&von=2026-10-01",
      "format=csv&von=2026-10-32&bis=2026-11-01",
      "format=csv&von=2026-11-01&bis=2026-10-01",
      "format=csv&von=2024-10-01&bis=2026-10-02",
      "format=xls&von=2026-10-01&bis=2026-10-31",
      "format=csv&von=2026-10-01&bis=2026-10-31&anders=1",
    ])
      expect((await sandra.anfrage(pfad(abfrage))).status, abfrage).toBe(400);
    expect((await sandra.anfrage(pfad("format=csv&von=2024-10-02&bis=2026-10-01"))).status).toBe(
      200,
    );
  });

  it("refuses whoever does not stamp, and a business without the module working time", async () => {
    const w = await weber();
    const extern = await w.server.eingeladen(w.jonas, "extern", "extern");
    expect((await csv(extern, "von=2026-10-01&bis=2026-10-31")).antwort.status).toBe(403);
    const solo = await w.server.inhaberMitBetrieb("Solo", "solo");
    await solo.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { arbeitszeit: false } });
    const aus = await csv(solo, "von=2026-10-01&bis=2026-10-31");
    expect(aus.antwort.status).toBe(403);
    expect(await json(aus.antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
  });
});

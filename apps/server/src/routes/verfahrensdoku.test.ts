import { pdfText, RECHTE_TEXTE, ROLLEN_NAMEN } from "@soll/export";
import { describe, expect, it } from "vitest";
import { RECHTE, ROLLEN } from "../auth/rollen.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import { ANGABEN, type Doku, text, weber } from "./verfahrensdoku-testhilfen.ts";

const lesen = async (wer: { anfrage: (pfad: string) => Promise<Response> }) =>
  (await (await wer.anfrage("/api/v1/verfahrensdoku")).json()) as Doku;

describe("GET /api/v1/verfahrensdoku", () => {
  it("makes the document from the business's state, incomplete without statements", async () => {
    const { jonas } = await weber();
    const { dokument, angaben } = await lesen(jonas);
    expect(dokument.titel).toBe("Verfahrensdokumentation Weber Haustechnik");
    expect(dokument.stand.programm).toBe("Soll");
    expect(dokument.stand.version).toBe("test");
    expect(dokument.stand.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dokument.stand.pruefwert).toMatch(/^Nr\. \d+ · [0-9a-f]{64}$/);
    expect(dokument.vollstaendig).toBe(false);
    expect(dokument.luecken).toBe(7);
    expect(angaben.eigene).toEqual([]);
    const inhalt = text(dokument);
    expect(inhalt).toContain("Modul Arbeitszeit (mit Abwesenheiten): eingeschaltet");
    expect(inhalt).toContain("Mitarbeiter (1 Mitglied)");
    expect(inhalt).toContain("Inhaber (1 Mitglied)");
    expect(inhalt).toContain("Die Prüfung beim Erzeugen dieses Dokuments fand keine Befunde.");
  });

  it("shows who did what without names or e-mail addresses of members", async () => {
    const { jonas } = await weber();
    const inhalt = JSON.stringify(await lesen(jonas));
    expect(inhalt).not.toContain("sandra");
    expect(inhalt).not.toContain("weber@betrieb.test");
  });

  it("is for the owner only", async () => {
    const { server, jonas, sandra } = await weber();
    const planer = await server.eingeladen(jonas, "planer", "anna");
    const lohn = await server.eingeladen(jonas, "lohnbuero", "lohn");
    for (const wer of [sandra, planer, lohn]) {
      expect((await wer.anfrage("/api/v1/verfahrensdoku")).status).toBe(403);
      expect((await wer.anfrage("/api/v1/verfahrensdoku/datei?format=md")).status).toBe(403);
      const put = await wer.anfrage("/api/v1/verfahrensdoku/angaben", {
        method: "PUT",
        body: ANGABEN,
      });
      expect(put.status).toBe(403);
    }
  });

  it("names a text for every role and right the server knows", () => {
    for (const rolle of ROLLEN) expect(ROLLEN_NAMEN[rolle], rolle).toBeTruthy();
    for (const recht of RECHTE) expect(RECHTE_TEXTE[recht], recht).toBeTruthy();
  });
});

describe("PUT /api/v1/verfahrensdoku/angaben", () => {
  it("saves the statements through the chain and makes the document complete", async () => {
    const { server, jonas } = await weber();
    const antwort = await jonas.anfrage("/api/v1/verfahrensdoku/angaben", {
      method: "PUT",
      body: { ...ANGABEN, rechtsform: "  Einzelunternehmen  " },
    });
    expect(antwort.status).toBe(200);
    expect(((await antwort.json()) as { angaben: unknown }).angaben).toEqual(ANGABEN);
    const { dokument, angaben } = await lesen(jonas);
    expect(angaben).toEqual(ANGABEN);
    expect(dokument.vollstaendig).toBe(true);
    expect(dokument.abschnitte.at(-1)).toEqual({
      titel: "12. Papier vor Soll",
      absaetze: ["Ordner im Büro"],
    });
    expect(text(dokument)).toContain("Rechtsform: Einzelunternehmen");
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
  });

  it("lists each saved version with its link (Rz. 154)", async () => {
    const { jonas } = await weber();
    for (const rechtsform of ["GmbH", "Einzelunternehmen"])
      await jonas.anfrage("/api/v1/verfahrensdoku/angaben", {
        method: "PUT",
        body: { ...ANGABEN, rechtsform },
      });
    const fassungen = (await lesen(jonas)).dokument.abschnitte.find((a) =>
      a.titel.startsWith("11."),
    );
    expect(fassungen?.liste).toHaveLength(2);
    expect(fassungen?.liste?.[0]).toMatch(/: Angaben gespeichert \(Glied Nr\. \d+\)$/);
  });

  it("refuses statements that are too long, unknown or too many sections", async () => {
    const { jonas } = await weber();
    const falsch = [
      { ...ANGABEN, rechtsform: "x".repeat(101) },
      { ...ANGABEN, fremd: "x" },
      { ...ANGABEN, eigene: Array.from({ length: 21 }, () => ({ titel: "a", text: "b" })) },
      { ...ANGABEN, eigene: [{ titel: "a" }] },
      null,
    ];
    for (const body of falsch) {
      const antwort = await jonas.anfrage("/api/v1/verfahrensdoku/angaben", {
        method: "PUT",
        body,
      });
      expect(antwort.status, JSON.stringify(body)?.slice(0, 40)).toBe(400);
    }
  });
});

describe("GET /api/v1/verfahrensdoku/datei", () => {
  it("gives the document as Markdown and as PDF with the day in the name", async () => {
    const { jonas } = await weber();
    const md = await jonas.anfrage("/api/v1/verfahrensdoku/datei?format=md");
    expect(md.status).toBe(200);
    expect(md.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(md.headers.get("content-disposition")).toMatch(
      /^attachment; filename="verfahrensdokumentation-\d{4}-\d{2}-\d{2}\.md"$/,
    );
    const inhalt = await md.text();
    expect(inhalt.startsWith("# Verfahrensdokumentation Weber Haustechnik\n")).toBe(true);
    expect(inhalt).toContain("> **Fehlt:** Rechtsform des Betriebs");
    const pdf = await jonas.anfrage("/api/v1/verfahrensdoku/datei?format=pdf");
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdfText(new Uint8Array(await pdf.arrayBuffer()))).toContain(
      "Verfahrensdokumentation Weber Haustechnik",
    );
  });

  it("refuses another format", async () => {
    const { jonas } = await weber();
    expect((await jonas.anfrage("/api/v1/verfahrensdoku/datei?format=docx")).status).toBe(400);
    expect((await jonas.anfrage("/api/v1/verfahrensdoku/datei")).status).toBe(400);
  });
});

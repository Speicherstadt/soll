import { describe, expect, it } from "vitest";
import { abschliessen, bestaetigen, type Person, um, weber } from "./monat-testhilfen.ts";

const zeilenVon = async (wer: Person, nutzerId: string, von = "2026-10-01", bis = "2026-11-30") => {
  const antwort = await wer.anfrage(
    `/api/v1/arbeitszeit/pruefexport?format=csv&von=${von}&bis=${bis}&nutzerId=${nutzerId}`,
  );
  return (await antwort.text()).split("\r\n");
};
const zeileAm = (zeilen: string[], datum: string) => zeilen.find((z) => z.includes(`;${datum};`));

const aendern = (wer: Person, stempelId: string, art: string, zeit: string, grund: string) =>
  wer.anfrage(`/api/v1/arbeitszeit/stempelungen/${stempelId}`, {
    method: "PATCH",
    body: { art, zeitpunkt: um(zeit), grund },
  });

describe("Prüfexport: changes across midnight and months (second review of S-309)", () => {
  it("files a night shift's Gehen moved back before midnight and forth again under the day the shift began", async () => {
    const w = await weber();
    const zurueck = await aendern(
      w.jonas,
      w.ids.nachtGehen,
      "gehen",
      "2026-10-31T23:30:00+01:00",
      "früher",
    );
    expect(zurueck.status).toBeLessThan(300);
    const neu = ((await zurueck.json()) as { stempelId: string }).stempelId;
    expect(
      (await aendern(w.jonas, neu, "gehen", "2026-11-01T03:00:00+01:00", "später")).status,
    ).toBeLessThan(300);
    const zeilen = await zeilenVon(w.jonas, w.sandra.nutzerId);
    const nacht = zeileAm(zeilen, "31.10.2026") ?? "";
    expect(nacht).toContain(";20:00;01.11.2026 03:00;");
    expect(nacht).toContain("Grund: früher");
    expect(nacht).toContain("Grund: später");
    expect(zeileAm(zeilen, "01.11.2026")).toBeUndefined();
  });

  it("files a removed Kommen that continued the shift of the day before under that day", async () => {
    const w = await weber();
    const [kommen] = await w.tag(w.sandra, [
      ["kommen", "2026-11-01T05:00:00+01:00"],
      ["gehen", "2026-11-01T07:00:00+01:00"],
    ]);
    const vorher = await zeilenVon(w.jonas, w.sandra.nutzerId);
    expect(zeileAm(vorher, "01.11.2026")).toBeUndefined();
    const entfernt = await w.jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${kommen}/entfernen`, {
      body: { grund: "falsch" },
    });
    expect(entfernt.status).toBeLessThan(300);
    const zeilen = await zeilenVon(w.jonas, w.sandra.nutzerId);
    expect(zeileAm(zeilen, "31.10.2026")).toContain("Grund: falsch");
    expect(zeileAm(zeilen, "01.11.2026")).toBeUndefined();
  });

  it("names the dates of a stamp moved into another month, and keeps the closed month as closed", async () => {
    const w = await weber();
    const verschoben = await aendern(
      w.jonas,
      w.ids.nachtKommen,
      "kommen",
      "2026-11-01T00:30:00+01:00",
      "später gekommen",
    );
    expect(verschoben.status).toBeLessThan(300);
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    const zeilen = await zeilenVon(w.jonas, w.sandra.nutzerId);
    const erster = zeileAm(zeilen, "01.11.2026") ?? "";
    expect(erster).toContain(";00:30;02:00;");
    // the move from 31 October is legible: "vorher Kommen 20:00, jetzt Kommen 00:30" alone hides the day
    expect(erster).toContain("vorher Kommen 31.10.2026 20:00, jetzt Kommen 00:30");
    // 31 October, closed without the shift, keeps the first entry of the Kommen it no longer has
    expect(zeileAm(zeilen, "31.10.2026")).toMatch(
      /^sandra;31\.10\.2026;;;0;0;;nachgetragen .*Kommen 20:00, Grund: Zettel;.*;Nr\. \d+ · [0-9a-f]{64}$/,
    );
    const sechster = zeileAm(zeilen, "06.10.2026") ?? "";
    expect(sechster).toMatch(/;Nr\. \d+ · [0-9a-f]{64}$/);
  });
});

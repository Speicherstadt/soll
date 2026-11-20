import { describe, expect, it } from "vitest";
import { testAbo } from "../modules/erinnerungen/push-test.ts";
import { testGeraet } from "./geraet-test-hilfen.ts";
import { abgeschlossen, type Json, json } from "./monat-testhilfen.ts";

/*
 * Third review of S-309: the owner's copy of someone else's Auskunft is an allowlist of what the
 * owner already sees elsewhere in Soll (docs/plan.md, "Auskunft"); a part of the person's own copy
 * that is not on it stays out, so a new table does not reach the owner by default.
 */

const FREIGEGEBEN = [
  "art",
  "fassung",
  "erstelltAm",
  "verantwortlicher",
  "person",
  "hinweise",
  "konto",
  "mitgliedschaft",
  "einladungen",
  "stempelungen",
  "gegeneintraege",
  "monatsabschluesse",
  "arbeitszeitmodelle",
  "schichten",
  "stundensaetze",
  "projektzeiten",
  "personalnummer",
  "ausweis",
  "auditKette",
];

describe("Auskunft given by the owner for someone else (third review of S-309)", () => {
  it("holds only the parts on the owner's allowlist; the person's own copy stays complete", async () => {
    const w = await abgeschlossen();
    const geraet = await testGeraet();
    expect(
      (
        await w.sandra.anfrage(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
          method: "PUT",
          body: { schluessel: geraet.schluessel },
        })
      ).status,
    ).toBe(201);
    // PINs belong to the Terminal module (S-603)
    await w.jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
    expect(
      (
        await w.jonas.anfrage(`/api/v1/terminal/pins/${w.sandra.nutzerId}`, {
          method: "PUT",
          body: { pin: "471100" },
        })
      ).status,
    ).toBe(204);
    const abo = testAbo("https://fcm.googleapis.com/fcm/send/sandra").json;
    await w.sandra.anfrage("/api/v1/arbeitszeit/erinnerungen/abos", {
      body: { ...abo, sprache: "pl" },
    });

    const eigen = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    for (const teil of ["geraete", "pin", "sitzungen", "anmeldung", "pushAbos"])
      expect(eigen[teil], teil).toBeDefined();
    expect((eigen.konto as Json).benutzername).toBeDefined();

    const fremd = await json(
      await w.jonas.anfrage(`/api/v1/auskunft?nutzerId=${w.sandra.nutzerId}`),
    );
    expect(Object.keys(fremd).sort()).toEqual([...FREIGEGEBEN].sort());
    // of the account only what the member list shows the owner (name, address)
    expect(Object.keys(fremd.konto as Json).sort()).toEqual(["email", "name"]);
    // and of the audit chain only links on tables whose rows the owner may see in this copy
    const kette = fremd.auditKette as { zuDeinenDaten: Json[]; vonDir: Json[] };
    const tabellen = new Set([...kette.zuDeinenDaten, ...kette.vonDir].map((g) => g.tabelle));
    for (const t of ["geraete", "pins", "pushAbos"]) expect(tabellen.has(t), t).toBe(false);
    expect(tabellen.has("stempelungen")).toBe(true);
    expect(tabellen.has("monatsabschluesse")).toBe(true);
    // the closing keeps its Prüfwert, the stamps their reasons
    const abschluss = (fremd.monatsabschluesse as Json[]).find(
      (a) => a.schritt === "abgeschlossen",
    );
    expect(abschluss?.pruefwert).toEqual(expect.any(String));
  });
});

import { describe, expect, it } from "vitest";
import { elbblick, weber } from "./beispiel.ts";
import { verfahrensdokuAus } from "./dokument.ts";
import { alsMarkdown } from "./markdown.ts";
import type { DokuStandDaten } from "./typen.ts";

/** The shift swap (S-504, docs/dienstplan.md "Schichttausch") in the Verfahrensdokumentation */

const TAG = "2026-11-25";
const md = (stand: DokuStandDaten) => alsMarkdown(verfahrensdokuAus(stand, TAG));

describe("shift swap", () => {
  it("describes offering, taking over and the approval with the rule check while the plan is on", () => {
    const text = md(elbblick);
    expect(text).toContain("Schichttausch:");
    expect(text).toContain("geben Inhaber oder Planer den Tausch frei");
    expect(text).toContain("Tausche freigeben und ablehnen");
    expect(text).toContain("Schichten zum Tausch anbieten und übernehmen");
    expect(text).toContain("Tausch: Jeden Tausch gibt Inhaber oder Planer frei");
  });

  it("names the setting without approval and when a swap still waits", () => {
    const text = md({ ...elbblick, tausch: { ohneFreigabe: true } });
    expect(text).toContain("Tausch ohne Freigabe ist eingeschaltet");
    expect(text).toContain("keinen Verstoß");
  });

  it("says in section 2 too that a clean takeover holds at once without approval", () => {
    const text = md({ ...elbblick, tausch: { ohneFreigabe: true } });
    const abschnitt2 = text.slice(text.indexOf("## 2"), text.indexOf("## 3"));
    expect(abschnitt2).toMatch(/ohne Freigabe/);
    expect(abschnitt2).not.toContain("danach geben Inhaber oder Planer den Tausch frei");
  });

  it("names the owner's setting of the swap among the rights only while the plan is on", () => {
    const rollen = [{ rolle: "inhaber", mitglieder: 1, rechte: ["betrieb:einrichten"] }];
    const setzen = "festlegen, ob ein Schichttausch ohne Freigabe gilt";
    expect(md({ ...elbblick, rollen })).toContain(setzen);
    const ohnePlan = { ...elbblick.module, dienstplan: false };
    expect(md({ ...elbblick, rollen, module: ohnePlan })).not.toContain(setzen);
  });

  it("says nothing of a swap while the plan is off", () => {
    expect(md(weber)).not.toMatch(/[Tt]ausch/);
  });
});

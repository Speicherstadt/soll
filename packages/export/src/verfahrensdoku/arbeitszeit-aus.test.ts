import { describe, expect, it } from "vitest";
import { elbblick, solo } from "./beispiel.ts";
import { verfahrensdokuAus } from "./dokument.ts";
import { alsMarkdown } from "./markdown.ts";

const TAG = "2026-11-25";

describe("working time off (review round 2)", () => {
  // apps/server/src/routes/kiosk.ts: /erkennen, /stempeln and /offline sit behind arbeitszeit(db),
  // 403 modul_aus while working time is off; the module Terminal can still be on (moduleSetzen)
  it("does not describe stamping at the terminal while working time is off", () => {
    const text = alsMarkdown(
      verfahrensdokuAus(
        {
          ...elbblick,
          module: { arbeitszeit: false, dienstplan: false, projektzeit: false, terminal: true },
        },
        TAG,
      ),
    );
    expect(text).not.toContain("Ohne Netz nimmt das Terminal Stempelungen weiter an");
    expect(text).not.toContain("Am Terminal erkennt der Server die Person");
  });

  // apps/server/src/modules/umzug/plan.ts:56 rejects times and absences with modul_aus while
  // working time is off, so no month is closed by an import
  it("does not describe closing months by import while working time is off", () => {
    const text = alsMarkdown(verfahrensdokuAus(solo, TAG));
    expect(solo.module.arbeitszeit).toBe(false);
    expect(text).not.toContain("schließt Soll mit Grund ab");
  });
});

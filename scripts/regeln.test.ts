import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * docs/regeln.md is the specification of every rule packages/arbeitszeit checks (BAULISTE.md S-103):
 * each rule carries the three cases erlaubt, Grenze and Verstoß with a source, and each norm of the
 * table "Rechtlicher Rahmen" in docs/plan.md has a rule.
 */
const regeln = readFileSync("docs/regeln.md", "utf8");
const plan = readFileSync("docs/plan.md", "utf8");

type Regel = { kennung: string; text: string };

const abschnitte = (): Regel[] =>
  regeln
    .split(/^### /m)
    .slice(1)
    .filter((teil) => /^R-\d{2} /.test(teil))
    .map((teil) => ({ kennung: teil.slice(0, 4), text: teil }));

/** The rows of the case table of a rule: cells without the outer pipes */
const faelle = (text: string): string[][] =>
  text
    .split("\n")
    .filter((zeile) => zeile.startsWith("|") && !/^\|\s*-/.test(zeile))
    .slice(1)
    .map((zeile) =>
      zeile
        .slice(1, -1)
        .split("|")
        .map((zelle) => zelle.trim()),
    );

/** The norms of the plan's table "Rechtlicher Rahmen", one per entry between semicolons */
const normenDesPlans = (): string[] => {
  const abschnitt = plan.split("## Rechtlicher Rahmen")[1] ?? "";
  const tabelle = abschnitt.slice(abschnitt.indexOf("| Regel")).split("\n\n")[0] ?? "";
  return tabelle
    .split("\n")
    .slice(2)
    .flatMap((zeile) => (zeile.split("|")[2] ?? "").split(";"))
    .map((norm) => norm.trim())
    .filter((norm) => norm !== "");
};

describe("docs/regeln.md", () => {
  const alle = abschnitte();

  it("numbers its rules R-01 onwards without gaps", () => {
    expect(alle.map((regel) => regel.kennung)).toEqual(
      alle.map((_, index) => `R-${String(index + 1).padStart(2, "0")}`),
    );
    expect(alle.length).toBeGreaterThanOrEqual(30);
  });

  it("gives every rule its norm, its severity and the cases erlaubt, Grenze and Verstoß with a source", () => {
    for (const regel of alle) {
      expect(regel.text, regel.kennung).toMatch(/\*\*Norm\*\*/);
      expect(regel.text, regel.kennung).toMatch(/\*\*Schwere\*\*/);
      const zeilen = faelle(regel.text);
      const arten = zeilen.map((zeile) => zeile[0]);
      for (const art of ["erlaubt", "Grenze", "Verstoß"])
        expect(arten, `${regel.kennung} ${art}`).toContain(art);
      for (const zeile of zeilen)
        expect(zeile.at(-1), `${regel.kennung}: ${zeile.join(" | ")}`).not.toBe("");
    }
  });

  it("has a rule for every norm of the plan's legal framework", () => {
    const normen = normenDesPlans();
    expect(normen.length).toBeGreaterThan(20);
    const zuordnung = new Map(
      regeln
        .split("\n")
        .filter((zeile) => zeile.startsWith("| ") && zeile.includes("| R-"))
        .map((zeile) => {
          const [norm = "", regel = ""] = zeile
            .slice(1, -1)
            .split("|")
            .map((zelle) => zelle.trim());
          return [norm, regel] as const;
        }),
    );
    const vorhanden = new Set(alle.map((regel) => regel.kennung));
    for (const norm of normen.flatMap((n) => [...zuordnung.keys()].filter((k) => k.includes(n)))) {
      const genannt = zuordnung.get(norm)?.match(/R-\d{2}/g) ?? [];
      expect(genannt.length, norm).toBeGreaterThan(0);
      for (const kennung of genannt)
        expect(vorhanden.has(kennung), `${norm} → ${kennung}`).toBe(true);
    }
    const ohneRegel = normen.filter((norm) => ![...zuordnung.keys()].some((k) => k.includes(norm)));
    expect(ohneRegel).toEqual([]);
  });

  it("writes durations as h:mm and never as decimal hours in a case", () => {
    for (const regel of alle) {
      for (const zeile of faelle(regel.text)) {
        expect(zeile.slice(1, -1).join(" "), regel.kennung).not.toMatch(/\b\d+[.,]\d+\s?(h|Std)\b/);
      }
    }
  });
});

/*
 * Review of S-103: cases whose expected result contradicts the norm they cite. Each check names the
 * source that settles it.
 */
describe("docs/regeln.md against the law", () => {
  const regel = (kennung: string): string =>
    abschnitte().find((r) => r.kennung === kennung)?.text ?? "";
  const zeile = (kennung: string, art: string): string[] =>
    faelle(regel(kennung)).find((z) => z[0] === art) ?? [];

  it("R-09: the Ersatzruhetag may lie anywhere in a two-week span that includes the Sunday", () => {
    // § 11 Abs. 3 Satz 1 ArbZG: "innerhalb eines den Beschäftigungstag einschließenden Zeitraums von
    // zwei Wochen" – a span of 14 days containing the Sunday reaches 13 days before or after it
    // (KomNet NRW, Dialog 28918: also before the Sunday). The 7th day after a Sunday is a Sunday,
    // never a Werktag, and checking only 7 days each side reports a Verstoß the law does not.
    const text = regel("R-09");
    expect(text).not.toMatch(/7 Tage davor und danach/);
    expect(zeile("R-09", "Grenze").join(" ")).not.toMatch(/7\. Tag danach/);
    expect(zeile("R-09", "Grenze").join(" ")).toMatch(/13\. Tag/);
  });

  it("R-20: three Sundays worked break § 17 Abs. 2 Satz 2 JArbSchG only in a month of four Sundays", () => {
    // "mindestens zwei Sonntage im Monat müssen beschäftigungsfrei bleiben": in November 2026
    // (Sundays 1, 8, 15, 22, 29) three worked Sundays leave two free; February 2026 has four.
    const verstoss = faelle(regel("R-20")).find((z) => z[1]?.includes("Sonntage im Monat")) ?? [];
    expect(verstoss[1]).toMatch(/vier Sonntage|4 Sonntage/);
  });

  it("R-23: a fraction under half a day is not rounded down (8,33 days are not 8)", () => {
    // § 5 Abs. 2 BUrlG rounds up from half a day only; smaller fractions stay owed as they are
    // (BAG, 26.01.1989, 8 AZR 730/87). Soll keeps half days and rounds 8,33 up to 8,5, as the
    // note under the table says.
    const teilurlaub = zeile("R-23", "Teilurlaub").join(" ");
    expect(teilurlaub).not.toMatch(/→ 8 Tage/);
    expect(teilurlaub).toMatch(/8,5 Tage/);
  });

  it("R-29: night and Sunday rates add up under R 3b Abs. 3 LStR, not Abs. 4", () => {
    // R 3b Abs. 3 LStR "Nachtarbeit an Sonntagen und Feiertagen" allows both exemptions side by
    // side; Abs. 4 "Feiertagsarbeit an Sonntagen" caps a Sunday that is a holiday at the holiday rate.
    expect(regel("R-29")).not.toMatch(/addieren sich, R 3b Abs\. 4 LStR/);
    expect(regel("R-29")).toMatch(/R 3b Abs\. 3 LStR/);
  });

  it("R-22: the Grenze case is the earliest day that keeps the four days' notice", () => {
    // § 12 Abs. 3 Satz 2 TzBfG with § 187 Abs. 1 BGB, as the rule reads it: four full days between
    // notice and work, so notice on Monday reaches Saturday exactly; Monday to Friday has three full
    // days between (Di, Mi, Do), not four.
    const grenze = zeile("R-22", "Grenze");
    expect(grenze[1]).toMatch(/^Mo – Sa/);
    expect(grenze[2]).toBe("kein Befund");
    const bisFreitag = faelle(regel("R-22")).filter((z) => /^Mo( 10:00)? – Fr/.test(z[1] ?? ""));
    for (const z of bisFreitag) expect(z.join(" ")).not.toMatch(/vier volle Tage/);
  });

  it("R-10: a month is removed after two years only when it carries no payroll", () => {
    // docs/plan.md, "Fristen je Monatsabschluss": 2 years without payroll (§ 16 Abs. 2 ArbZG),
    // 6 years as a payroll record, 8 years as an accounting voucher (§ 147 Abs. 3 Satz 1 AO).
    const erlaubt = zeile("R-10", "erlaubt").join(" ");
    expect(erlaubt).toMatch(/ohne Lohnbezug/);
  });

  it("R-10: an accounting voucher is kept eight years, not ten, since 2025", () => {
    // § 147 Abs. 3 Satz 1 AO as amended by the Viertes Bürokratieentlastungsgesetz (in force since
    // 01.01.2025): "die in Absatz 1 Nummer 4 aufgeführten Unterlagen sind acht Jahre" – Nummer 4 are
    // the Buchungsbelege; ten years remain for books and records (Nummer 1 and 4a).
    expect(regel("R-10")).not.toMatch(/Buchungsbeleg 10 Jahre/);
    expect(regel("R-10")).toMatch(/Buchungsbeleg 8 Jahre/);
    expect(plan).not.toMatch(/10 Jahre als Buchungsbeleg/);
  });

  it("R-21: work after the birth is allowed after two weeks when the child has died", () => {
    // § 3 Abs. 4 MuSchG: after the death of the child the woman may work once the first two weeks
    // after the birth have passed, if she asks for it and a medical certificate does not object.
    expect(regel("R-21")).toMatch(/§ 3 Abs\. 4 MuSchG/);
  });
  it("R-09: thirteen days before a Sunday is the Monday of the week before, not two weeks before", () => {
    // § 11 Abs. 3 Satz 1 ArbZG, 14-day span: Sunday 15.11.2026 − 13 days = Monday 2.11.2026, the
    // Monday of the week 2.–8.11. (the week before 9.–15.11.); "zwei Wochen davor" would be 26.10.
    // The mirror image of "Samstag der übernächsten Woche" (+13 days, 28.11.2026).
    expect(regel("R-09")).not.toMatch(/Montag\s+zwei\s+Wochen\s+davor/);
    expect(regel("R-09")).toMatch(/Montag\s+der\s+Vorwoche/);
  });

  it("R-23: fractions under half a day are never rounded down", () => {
    // § 5 Abs. 2 BUrlG rounds up from half a day only; smaller fractions stay owed (BAG, 26.01.1989,
    // 8 AZR 730/87). The note must not say they are rounded down, which the Teilurlaub case denies.
    expect(regel("R-23")).not.toMatch(/nach unten gerundet/);
  });

  it("R-23: Teilurlaub under § 5 Abs. 1 Buchst. a is carried over the whole next year on request", () => {
    // § 7 Abs. 3 Satz 4 BUrlG: "Auf Verlangen des Arbeitnehmers ist ein nach § 5 Abs. 1 Buchstabe a
    // entstehender Teilurlaub jedoch auf das nächste Kalenderjahr zu übertragen" – not only to
    // 31 March. The rule's own Teilurlaub case (Eintritt 1.8.) is exactly that Teilurlaub.
    expect(regel("R-23")).toMatch(/§ 7 Abs\. 3 Satz 4/);
  });

  it("R-14: Sunday and holiday surcharges count toward the minimum wage, night surcharges do not", () => {
    // BAG, 24.05.2017, 5 AZR 431/16, and 17.01.2018, 5 AZR 69/17: Sonn- und Feiertagszuschläge are
    // "grundsätzlich mindestlohnwirksam"; payments with a special statutory purpose such as the
    // night surcharge of § 6 Abs. 5 ArbZG are not (BAG, 25.05.2016, 5 AZR 135/16). Leaving Sunday
    // surcharges out reports a Verstoß the law does not.
    expect(regel("R-14")).not.toMatch(/Zuschläge für Nacht, Sonn- und Feiertage zählen nicht mit/);
    expect(regel("R-14")).toMatch(/5 AZR 431\/16/);
  });
  it("R-03: leave and sick days are neutral in the average, never working days with 0 h", () => {
    // Art. 16 Buchst. b Unterabs. 2 RL 2003/88/EG: "Die nach Artikel 7 gewährten Zeiten des bezahlten
    // Jahresurlaubs sowie die Krankheitszeiten bleiben bei der Berechnung des Durchschnitts
    // unberücksichtigt oder sind neutral"; BVerwG, 09.05.2018, 8 C 13/17: statutory leave days are
    // no Ausgleichstage. Counting them as Werktage with 0 h lowers the average and hides a Verstoß.
    expect(regel("R-03")).not.toMatch(/als Werktage mit 0 h/);
    expect(regel("R-03")).toMatch(/Art\. 16 Buchst\. b/);
  });

  it("R-21: § 3 MuSchG has twelve weeks after a disability is found and periods after a miscarriage", () => {
    // § 3 Abs. 2 Satz 2 Nr. 3 MuSchG (twelve weeks on request when a disability of the child is found
    // within eight weeks) and § 3 Abs. 5 MuSchG (Fehlgeburt from the 13th, 17th, 20th week: two, six,
    // eight weeks unless she declares herself ready to work), in force since 01.06.2025, before
    // Regelversion 2026-1.
    expect(regel("R-21")).toMatch(/§ 3 Abs\. 5 MuSchG/);
    expect(regel("R-21")).toMatch(/Behinderung/);
    expect(faelle(regel("R-21")).some((z) => /Fehlgeburt/.test(z[1] ?? ""))).toBe(true);
  });

  it("R-23: a twelfth per month applies to at most six full months; seven months earn the full leave", () => {
    // § 5 Abs. 1 BUrlG: Teilurlaub only (a) when the Wartezeit of § 4 is not fulfilled in the year,
    // which needs a start after 1 July (at most five full months), (b) on leaving before the
    // Wartezeit (under six months) or (c) on leaving in the first half of the year (at most six).
    // Seven full months in a year mean the Wartezeit was fulfilled and the full leave is owed
    // (start 1.6.: Wartezeit ends 30.11.), never 7/12 of it.
    for (const z of faelle(regel("R-23")).filter((r) => /Monate/.test(r[1] ?? ""))) {
      const monate = Number(/(\d+) volle Monate/.exec(z.join(" "))?.[1] ?? 0);
      if (monate > 6) expect(z[2], z.join(" | ")).toMatch(/^20 Tage/);
    }
    expect(faelle(regel("R-23")).some((z) => /Wartezeit/.test(z.join(" ")))).toBe(true);
  });
});

describe("docs/regeln.md: the overview against the rules", () => {
  /** The severity column of the overview table, by rule */
  const uebersicht = new Map(
    (regeln.split("## Übersicht")[1] ?? "")
      .split("\n")
      .filter((zeile) => /^\| R-\d{2} \|/.test(zeile))
      .map((zeile) => {
        const zellen = zeile
          .slice(1, -1)
          .split("|")
          .map((zelle) => zelle.trim());
        return [zellen[0] ?? "", zellen.at(-1) ?? ""] as const;
      }),
  );

  /** The text of a rule's "Schwere" bullet, up to the next bullet or blank line */
  const schwere = (text: string): string =>
    /\*\*Schwere\*\*:([\s\S]*?)(?=\n- \*\*|\n\n)/.exec(text)?.[1] ?? "";

  it("names in the overview every severity a rule can report", () => {
    // Each rule's "Schwere" is the source; the overview only sums it up. R-03 warns before the
    // period ends (Hinweis) and R-05 warns while a shortened rest in § 5 Abs. 2 ArbZG awaits its
    // compensation (Hinweis), so "Verstoß" alone in the overview is wrong for both.
    for (const regel of abschnitte()) {
      const zeile = uebersicht.get(regel.kennung) ?? "";
      const eigen = schwere(regel.text);
      for (const stufe of ["Hinweis", "Verstoß"])
        if (eigen.includes(stufe))
          expect(zeile, `${regel.kennung}: ${eigen.trim()}`).toContain(stufe);
    }
  });
});

/*
 * Review of PR #15: the merge with main kept both versions of the decision "Uhrzeit in Berlin", one
 * of which no longer names `eingabeInBerlin`. Each question is decided once in docs/plan.md.
 */
describe("docs/plan.md", () => {
  it("decides each question once in the table Entscheidungen", () => {
    const abschnitt = (plan.split("## Entscheidungen")[1] ?? "").split("\n## ")[0] ?? "";
    const fragen = abschnitt
      .split("\n")
      .filter((zeile) => zeile.startsWith("| ") && !/^\|\s*-/.test(zeile))
      .map((zeile) => zeile.split("|")[1]?.trim() ?? "");
    expect(fragen.filter((frage, index) => fragen.indexOf(frage) !== index)).toEqual([]);
  });
});

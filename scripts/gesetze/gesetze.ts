/*
 * Gesetzeswächter (BAULISTE.md S-906): fetches the norms Soll relies on from gesetze-im-internet.de,
 * compares the SHA-256 of their normalised text with scripts/gesetze/normen.json, looks for missing
 * yearly values and writes a report. Runs weekly in .github/workflows/gesetze.yml; after
 * firsttris/haben, scripts/jahreswerte/pruefen.ts.
 *
 *   bun run gesetze                     report on stdout, nothing else
 *   bun run gesetze --bericht <datei>   also write the report to a file
 *   bun run gesetze --schreiben         take the current hashes into normen.json
 *   bun run gesetze --issue             open or update the one issue (GITHUB_TOKEN, GITHUB_REPOSITORY)
 *
 * A source that does not answer is a warning; the run does not fail for it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  kinderkrankentage,
  MINDESTLOHN,
  mindestlohnAm,
  minijobGrenzeAm,
} from "../../packages/arbeitszeit/src/jahreswerte/index.ts";
import { tagInBerlin } from "../../packages/arbeitszeit/src/kalender/zeit.ts";
import { type Ergebnis, type Holen, mitWiederholung, zusammen } from "./abruf.ts";
import { githubApi, issueAbgleichen } from "./issue.ts";
import { hoechsteMiLoV, type Jahreswerte, pruefeJahreswerte } from "./jahreswerte.ts";
import { ladeNormen, NORMEN_DATEI, type Norm } from "./liste.ts";
import { mitAktuellenHashes, type NormStand, pruefeNormen } from "./normen.ts";
import { normenDatei } from "./normendatei.ts";
import { regelnJeNorm } from "./zitate.ts";

export type Stand = {
  /** Berlin calendar day of the run */
  heute: string;
  normen: readonly Norm[];
  /** The text of docs/regeln.md, to name the rules citing a changed norm */
  regeln: string;
  werte: Jahreswerte;
  bekannteMiLoV: number;
};

export async function pruefeAlles(
  s: Stand,
  holen: Holen,
): Promise<{ ergebnis: Ergebnis; stand: NormStand[] }> {
  const [normen, jahreswerte] = await Promise.all([
    pruefeNormen(s.normen, regelnJeNorm(s.regeln), holen),
    pruefeJahreswerte(s.heute, s.werte, s.bekannteMiLoV, holen),
  ]);
  return { ergebnis: zusammen([normen.ergebnis, jahreswerte]), stand: normen.stand };
}

const zaehle = (stand: readonly NormStand[]) => {
  const anzahl = (z: NormStand["zustand"]) => stand.filter((s) => s.zustand === z).length;
  return `${stand.length} Norm(en) beobachtet: ${anzahl("gleich")} gleich, ${anzahl("geaendert")} geändert, ${anzahl("neu")} noch kein Stand, ${anzahl("weg")} nicht mehr abrufbar, ${anzahl("fehler")} nicht erreicht.`;
};

const ohneStand = (stand: readonly NormStand[]) =>
  stand
    .filter((s) => s.norm.sha256 === "")
    .map((s) => `- ${s.norm.norm}: ${s.sha256 ? `\`${s.sha256}\`` : "noch nicht erreicht"}`);

/** The report in Markdown, for the console, a file and the job summary */
export function bericht(
  heute: string,
  { befunde, warnungen }: Ergebnis,
  stand: readonly NormStand[],
): string {
  const neu = ohneStand(stand);
  return [
    `# Gesetzeswächter, Lauf vom ${heute}`,
    zaehle(stand),
    "## Befunde",
    befunde.length === 0
      ? "Keine Befunde: kein Issue."
      : befunde.map((b) => `### ${b.titel}\n\n${b.text}`).join("\n\n"),
    ...(warnungen.length > 0 ? ["## Warnungen", warnungen.map((w) => `- ${w}`).join("\n")] : []),
    ...(neu.length > 0
      ? [
          "## Noch kein Stand",
          "Diese Normen haben noch keinen Hash in scripts/gesetze/normen.json; `--schreiben` übernimmt die erreichten.",
          neu.join("\n"),
        ]
      : []),
  ].join("\n\n");
}

const wert = (argv: readonly string[], name: string) => {
  const i = argv.indexOf(name);
  return i < 0 ? undefined : argv[i + 1];
};

async function main(argv: readonly string[]): Promise<void> {
  const heute = tagInBerlin(Date.now());
  const { ergebnis, stand } = await pruefeAlles(
    {
      heute,
      normen: ladeNormen(),
      regeln: readFileSync(new URL("../../docs/regeln.md", import.meta.url), "utf8"),
      werte: { mindestlohnAm, minijobGrenzeAm, kinderkrankentage },
      bekannteMiLoV: hoechsteMiLoV(MINDESTLOHN),
    },
    mitWiederholung(fetch),
  );
  const text = bericht(heute, ergebnis, stand);
  console.log(text);
  if (process.env.GITHUB_ACTIONS === "true")
    for (const w of ergebnis.warnungen) console.log(`::warning::${w}`);
  const datei = wert(argv, "--bericht");
  if (datei) writeFileSync(datei, `${text}\n`);
  if (argv.includes("--schreiben"))
    writeFileSync(NORMEN_DATEI, normenDatei(mitAktuellenHashes(stand)));
  if (!argv.includes("--issue")) return;
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo)
    throw new Error("GITHUB_TOKEN und GITHUB_REPOSITORY fehlen; ohne Issue: ohne --issue");
  console.log(`Issue: ${(await issueAbgleichen(githubApi(token), repo, ergebnis.befunde)).art}`);
}

if (import.meta.main) await main(process.argv.slice(2));

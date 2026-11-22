/*
 * The findings as one GitHub issue with the label "gesetzeswaechter" (REST API,
 * https://docs.github.com/en/rest/issues). An open issue with the label is the one: same findings,
 * nothing happens; other findings, it gets a comment and the new list as its text. No findings, no
 * issue. Which findings an issue lists is a hash in its text (HTML comment). After
 * firsttris/haben, scripts/jahreswerte/issues.ts, which opens one issue per finding instead.
 */
import { createHash } from "node:crypto";
import type { Befund } from "./abruf.ts";
import { DOKU } from "./normen.ts";

export const LABEL = "gesetzeswaechter";
export const TITEL = "Gesetzeswächter: Normen oder Jahreswerte nachziehen";
const LABEL_FARBE = "c5def5";
const LABEL_BESCHREIBUNG =
  "Eine Norm hat sich geändert oder ein Jahreswert fehlt (Workflow „Gesetzeswächter“)";

/** A call of the GitHub API; `pfad` without the host, e.g. `/repos/Speicherstadt/soll/issues` */
export type GitHub = (
  methode: "GET" | "POST" | "PATCH",
  pfad: string,
  daten?: unknown,
) => Promise<{ status: number; daten: unknown }>;

export type Issue = { number: number; title: string; body: string | null; pull_request?: unknown };

export type Aktion =
  | { art: "nichts" }
  | { art: "anlegen" }
  | { art: "aktualisieren"; nummer: number }
  | { art: "unveraendert"; nummer: number };

const MARKE = /<!-- gesetzeswaechter:([0-9a-f]+) -->/;
const inhaltHash = (befunde: readonly Befund[]) =>
  createHash("sha256").update(JSON.stringify(befunde)).digest("hex").slice(0, 16);

export const issueText = (befunde: readonly Befund[]): string =>
  [
    `Der Gesetzeswächter hat ${befunde.length} Befund(e). Was zu tun ist: ${DOKU}`,
    ...befunde.map((b) => `## ${b.titel}\n\n${b.text}`),
    "---",
    "Geöffnet vom Workflow „Gesetzeswächter“ (`.github/workflows/gesetze.yml`). Erledigt: schließen; besteht ein Befund beim nächsten Lauf noch, öffnet er ein neues Issue. Das Label „gesetzeswaechter“ bitte lassen, daran findet der Workflow sein Issue.",
    `<!-- gesetzeswaechter:${inhaltHash(befunde)} -->`,
  ].join("\n\n");

/** What happens, given the open issues with the label */
export function plane(befunde: readonly Befund[], offen: readonly Issue[]): Aktion {
  if (befunde.length === 0) return { art: "nichts" };
  const issue = offen.filter((i) => !i.pull_request).sort((a, b) => a.number - b.number)[0];
  if (!issue) return { art: "anlegen" };
  const bisher = MARKE.exec(issue.body ?? "")?.[1];
  return bisher === inhaltHash(befunde)
    ? { art: "unveraendert", nummer: issue.number }
    : { art: "aktualisieren", nummer: issue.number };
}

function erwarte(antwort: { status: number; daten: unknown }, was: string): unknown {
  if (antwort.status < 200 || antwort.status >= 300)
    throw new Error(
      `GitHub: ${was} fehlgeschlagen (HTTP ${antwort.status}): ${JSON.stringify(antwort.daten)}`,
    );
  return antwort.daten;
}

async function sicherstelleLabel(gh: GitHub, repo: string): Promise<void> {
  const vorhanden = await gh("GET", `/repos/${repo}/labels/${LABEL}`);
  if (vorhanden.status === 200) return;
  if (vorhanden.status !== 404) erwarte(vorhanden, "Label lesen");
  const label = { name: LABEL, color: LABEL_FARBE, description: LABEL_BESCHREIBUNG };
  erwarte(await gh("POST", `/repos/${repo}/labels`, label), "Label anlegen");
}

async function ausfuehren(gh: GitHub, repo: string, aktion: Aktion, befunde: readonly Befund[]) {
  if (aktion.art === "anlegen") {
    const issue = { title: TITEL, body: issueText(befunde), labels: [LABEL] };
    erwarte(await gh("POST", `/repos/${repo}/issues`, issue), "Issue anlegen");
  }
  if (aktion.art !== "aktualisieren") return;
  const liste = befunde.map((b) => `- ${b.titel}`).join("\n");
  const kommentar = { body: `Die Befunde haben sich geändert, jetzt:\n\n${liste}` };
  erwarte(
    await gh("POST", `/repos/${repo}/issues/${aktion.nummer}/comments`, kommentar),
    "Kommentar anlegen",
  );
  const neu = { title: TITEL, body: issueText(befunde) };
  erwarte(await gh("PATCH", `/repos/${repo}/issues/${aktion.nummer}`, neu), "Issue aktualisieren");
}

/** Brings the one issue in line with the findings and says what happened */
export async function issueAbgleichen(
  gh: GitHub,
  repo: string,
  befunde: readonly Befund[],
): Promise<Aktion> {
  if (befunde.length === 0) return { art: "nichts" };
  await sicherstelleLabel(gh, repo);
  const offen = erwarte(
    await gh("GET", `/repos/${repo}/issues?state=open&labels=${LABEL}&per_page=100`),
    "Issues lesen",
  ) as Issue[];
  const aktion = plane(befunde, offen);
  await ausfuehren(gh, repo, aktion, befunde);
  return aktion;
}

/** The real API with the workflow's token */
export const githubApi =
  (token: string, holen: typeof fetch = fetch): GitHub =>
  async (methode, pfad, daten) => {
    const antwort = await holen(`https://api.github.com${pfad}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      ...(daten === undefined ? {} : { body: JSON.stringify(daten) }),
    });
    const inhalt = await antwort.text();
    return { status: antwort.status, daten: inhalt ? JSON.parse(inhalt) : null };
  };

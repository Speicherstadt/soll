import { describe, expect, it } from "vitest";
import type { Befund } from "./abruf.ts";
import {
  type GitHub,
  type Issue,
  issueAbgleichen,
  issueText,
  LABEL,
  plane,
  TITEL,
} from "./issue.ts";

const REPO = "Speicherstadt/soll";
const norm: Befund = { schluessel: "norm-arbzg-3", titel: "§ 3 ArbZG geändert", text: "Quelle …" };
const lohn: Befund = {
  schluessel: "jahreswert-mindestlohn-2028",
  titel: "Mindestlohn 2028 nicht hinterlegt",
  text: "…",
};

/** A stand-in GitHub API: label and issues in memory, every writing call recorded */
function githubImSpeicher(
  start: { issues?: (Issue & { pull_request?: object })[]; label?: boolean } = {},
) {
  const issues = [...(start.issues ?? [])];
  let label = start.label ?? true;
  const schreibend: { methode: string; pfad: string; daten: unknown }[] = [];
  const gh: GitHub = async (methode, pfad, daten) => {
    if (methode !== "GET") schreibend.push({ methode, pfad, daten });
    if (methode === "GET" && pfad === `/repos/${REPO}/labels/${LABEL}`)
      return label
        ? { status: 200, daten: { name: LABEL } }
        : { status: 404, daten: { message: "Not Found" } };
    if (methode === "POST" && pfad === `/repos/${REPO}/labels`) {
      label = true;
      return { status: 201, daten };
    }
    if (
      methode === "GET" &&
      pfad === `/repos/${REPO}/issues?state=open&labels=${LABEL}&per_page=100`
    )
      return { status: 200, daten: issues };
    if (methode === "POST" && pfad === `/repos/${REPO}/issues`) {
      const d = daten as { title: string; body: string };
      issues.push({ number: issues.length + 1, title: d.title, body: d.body });
      return { status: 201, daten: {} };
    }
    if (pfad.startsWith(`/repos/${REPO}/issues/`))
      return { status: methode === "PATCH" ? 200 : 201, daten: {} };
    return { status: 500, daten: { message: `nicht nachgestellt: ${methode} ${pfad}` } };
  };
  return { gh, issues, schreibend };
}

describe("the one issue of the Gesetzeswächter", () => {
  it("creates the label and one issue listing every finding", async () => {
    const api = githubImSpeicher({ label: false });
    expect(await issueAbgleichen(api.gh, REPO, [norm, lohn])).toEqual({ art: "anlegen" });
    expect(api.schreibend.map((s) => `${s.methode} ${s.pfad}`)).toEqual([
      `POST /repos/${REPO}/labels`,
      `POST /repos/${REPO}/issues`,
    ]);
    expect(api.schreibend[1]?.daten).toEqual({
      title: TITEL,
      body: issueText([norm, lohn]),
      labels: [LABEL],
    });
    expect(issueText([norm, lohn])).toContain("## § 3 ArbZG geändert");
    expect(issueText([norm, lohn])).toContain("## Mindestlohn 2028 nicht hinterlegt");
  });

  it("touches nothing on the next run with the same findings", async () => {
    const api = githubImSpeicher();
    await issueAbgleichen(api.gh, REPO, [norm]);
    expect(await issueAbgleichen(api.gh, REPO, [norm])).toEqual({ art: "unveraendert", nummer: 1 });
    expect(api.issues).toHaveLength(1);
    expect(api.schreibend).toHaveLength(1);
  });

  it("comments on the open issue and replaces its text when the findings change", async () => {
    const api = githubImSpeicher({
      issues: [{ number: 7, title: TITEL, body: issueText([norm]) }],
    });
    expect(await issueAbgleichen(api.gh, REPO, [norm, lohn])).toEqual({
      art: "aktualisieren",
      nummer: 7,
    });
    expect(api.schreibend.map((s) => `${s.methode} ${s.pfad}`)).toEqual([
      `POST /repos/${REPO}/issues/7/comments`,
      `PATCH /repos/${REPO}/issues/7`,
    ]);
    expect(JSON.stringify(api.schreibend[0]?.daten)).toContain("Mindestlohn 2028 nicht hinterlegt");
    expect(api.schreibend[1]?.daten).toEqual({ title: TITEL, body: issueText([norm, lohn]) });
  });

  it("opens no issue and calls no API when nothing changed", async () => {
    const gh: GitHub = async () => {
      throw new Error("nicht erwartet");
    };
    expect(await issueAbgleichen(gh, REPO, [])).toEqual({ art: "nichts" });
  });

  it("does not take a pull request for its issue", () => {
    const pr = { number: 3, title: TITEL, body: issueText([norm]), pull_request: {} };
    expect(plane([norm], [pr])).toEqual({ art: "anlegen" });
  });

  it("stops at an error of the API", async () => {
    const gh: GitHub = async (methode) =>
      methode === "GET"
        ? { status: 200, daten: [] }
        : { status: 403, daten: { message: "Resource not accessible by integration" } };
    await expect(issueAbgleichen(gh, REPO, [norm])).rejects.toThrow(
      "Issue anlegen fehlgeschlagen (HTTP 403)",
    );
  });
});

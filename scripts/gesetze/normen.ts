/*
 * The Gesetzeswächter for norms: fetches each norm of the watch list and compares the SHA-256 of its
 * normalised text with the one stored. After firsttris/haben, scripts/jahreswerte/normen.ts.
 */
import {
  abrufen,
  type Befund,
  begrenzt,
  beschreibe,
  type Ergebnis,
  type Holen,
  sha256,
  text,
  zusammen,
} from "./abruf.ts";
import type { Norm } from "./liste.ts";
import { normText } from "./normtext.ts";

export const DOKU = "https://soll.work/gesetzeswaechter.html";
const PARALLEL = 4;

/** gleich: same text; geaendert: other text; neu: no hash stored yet; weg: 404; fehler: no answer */
export type Zustand = "gleich" | "geaendert" | "neu" | "weg" | "fehler";

export type NormStand = { norm: Norm; sha256: string | null; zustand: Zustand };

type Aktuell = { sha256: string | null; problem: string | null; weg: boolean };

async function aktuell(norm: Norm, holen: Holen): Promise<Aktuell> {
  const a = await abrufen(holen, norm.url);
  // 404 is a clear answer (repealed, renumbered, new address), not an outage like 503
  if (a.art === "antwort" && a.status === 404) return { sha256: null, problem: null, weg: true };
  if (a.art === "fehler" || a.status !== 200)
    return { sha256: null, problem: `nicht erreichbar (${beschreibe(a)})`, weg: false };
  const t = normText(text(a));
  if (t === null) return { sha256: null, problem: "keine Einzelnorm erkannt", weg: false };
  return { sha256: await sha256(t), problem: null, weg: false };
}

const zustand = (norm: Norm, a: Aktuell): Zustand => {
  if (a.weg) return "weg";
  if (a.sha256 === null) return "fehler";
  if (norm.sha256 === "") return "neu";
  return norm.sha256 === a.sha256 ? "gleich" : "geaendert";
};

const zitiertIn = (norm: Norm, regeln: ReadonlyMap<string, string[]>) => {
  const liste = regeln.get(norm.norm) ?? [];
  return liste.length > 0
    ? `Zitiert in docs/regeln.md: ${liste.join(", ")}.`
    : "In docs/regeln.md nicht als Regel zitiert.";
};

const geaendert = (norm: Norm, neu: string, regeln: ReadonlyMap<string, string[]>): Befund => ({
  schluessel: `norm-${norm.id}`,
  titel: `${norm.norm} geändert`,
  text: [
    `Der Text von ${norm.norm} auf gesetze-im-internet.de hat sich geändert: ${norm.url}`,
    `Soll braucht die Norm für: ${norm.zweck}. ${zitiertIn(norm, regeln)}`,
    `Zu tun: die Änderung lesen (Fußnoten und Textnachweis nennen das ändernde Gesetz und ab wann es gilt), docs/regeln.md und packages/arbeitszeit prüfen, eine neue Regelversion anlegen, wenn sich eine Grenze ändert, und danach den Hash übernehmen (\`bun run gesetze --schreiben\`). Bisher \`${norm.sha256}\`, jetzt \`${neu}\`. Schritte: ${DOKU}`,
  ].join("\n\n"),
});

const weg = (norm: Norm, regeln: ReadonlyMap<string, string[]>): Befund => ({
  schluessel: `norm-${norm.id}`,
  titel: `${norm.norm} ist nicht mehr abrufbar`,
  text: [
    `${norm.url} antwortet mit 404: Die Norm ist aufgehoben, umnummeriert, oder das Gesetz steht unter einer neuen Adresse.`,
    `Soll braucht die Norm für: ${norm.zweck}. ${zitiertIn(norm, regeln)}`,
    `Zu tun: im Inhaltsverzeichnis des Gesetzes oder im Bundesgesetzblatt nachsehen, was aus der Norm geworden ist, die Regeln prüfen und in scripts/gesetze/normen.json die neue Adresse eintragen (Hash leeren, mit \`bun run gesetze --schreiben\` neu setzen) oder die Norm streichen. Schritte: ${DOKU}`,
  ].join("\n\n"),
});

const bewerte = (stand: NormStand, a: Aktuell, regeln: ReadonlyMap<string, string[]>): Ergebnis => {
  const { norm } = stand;
  if (stand.zustand === "weg") return { befunde: [weg(norm, regeln)], warnungen: [] };
  if (stand.zustand === "fehler")
    return { befunde: [], warnungen: [`${norm.norm}: ${norm.url} ${a.problem}`] };
  if (stand.zustand === "geaendert" && a.sha256 !== null)
    return { befunde: [geaendert(norm, a.sha256, regeln)], warnungen: [] };
  return { befunde: [], warnungen: [] };
};

/** Fetches every norm; `regeln` maps "§ 3 ArbZG" to the rules that cite it */
export async function pruefeNormen(
  normen: readonly Norm[],
  regeln: ReadonlyMap<string, string[]>,
  holen: Holen,
): Promise<{ ergebnis: Ergebnis; stand: NormStand[] }> {
  const geprueft = await begrenzt(normen, PARALLEL, async (norm) => {
    const a = await aktuell(norm, holen);
    const stand: NormStand = { norm, sha256: a.sha256, zustand: zustand(norm, a) };
    return { stand, ergebnis: bewerte(stand, a, regeln) };
  });
  return {
    ergebnis: zusammen(geprueft.map((g) => g.ergebnis)),
    stand: geprueft.map((g) => g.stand),
  };
}

/** The watch list with the current hashes; a norm that could not be read keeps its old one */
export const mitAktuellenHashes = (stand: readonly NormStand[]): Norm[] =>
  stand.map(({ norm, sha256 }) => ({ ...norm, sha256: sha256 ?? norm.sha256 }));

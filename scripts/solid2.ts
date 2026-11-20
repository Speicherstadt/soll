/**
 * Fails on Solid 1.x forms in the client code (CLAUDE.md, "Solid 2.0"; source of every rule:
 * docs/solid-2.0/MIGRATION.md). The compiler already rejects some of them on native elements
 * (classList, use:, on:, attr:, bool:); this check also catches them in .ts files, on components,
 * and the 1.x APIs that still type-check but behave as 1.x did.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type Regel = { name: string; muster: RegExp; statt: string };

/** One rule per forbidden form, with the 2.0 replacement named in the message */
export const REGELN: readonly Regel[] = [
  {
    name: "createResource",
    muster: /\bcreateResource\b/,
    statt: "async createMemo or useQuery under <Loading>",
  },
  {
    name: "Suspense",
    muster: /<\/?Suspense(List)?\b|\bSuspense(List)?\s*[,}]/,
    statt: "Loading / Reveal",
  },
  { name: "ErrorBoundary", muster: /\bErrorBoundary\b/, statt: "Errored" },
  { name: "onMount", muster: /\bonMount\b/, statt: "onSettled" },
  { name: "on helper", muster: /\bon\(\s*[\w[]/, statt: "createEffect(source, fn)" },
  {
    name: "createComputed",
    muster: /\bcreateComputed\b/,
    statt: "createMemo / createSignal(fn) / split createEffect",
  },
  { name: "batch", muster: /\bbatch\(/, statt: "nothing (writes are batched) or flush()" },
  { name: "classList", muster: /\bclassList\b/, statt: "class with an object or array" },
  {
    name: "namespace",
    muster: /\s(use|attr|bool|on|oncapture|class|style):[a-zA-Z]/,
    statt: "ref factories, plain attributes, onClick, class/style objects",
  },
  {
    name: "Index",
    muster: /<\/?Index\b|\bindexArray\b/,
    statt: "<For keyed={false}> / mapArray(…, { keyed: false })",
  },
  { name: "mergeProps/splitProps", muster: /\b(mergeProps|splitProps)\b/, statt: "merge / omit" },
  {
    name: "store helpers",
    muster: /\b(unwrap|produce|createMutable|modifyMutable)\b/,
    statt: "snapshot / draft setters / createStore",
  },
  {
    name: "transitions",
    muster: /\b(startTransition|useTransition)\b/,
    statt: "isPending, action, createOptimistic",
  },
  { name: "Provider", muster: /\.Provider\b/, statt: "<Context value>" },
  {
    name: "1.x error and selector APIs",
    muster:
      /\b(catchError|onError|createSelector|createDynamic|resetErrorBoundaries|equalFn|getListener)\b/,
    statt: "Errored / effect error option / createProjection / dynamic()",
  },
  {
    name: "1.x imports",
    muster: /from\s+["']solid-js\/(web|store|h|html|universal|jsx-runtime|jsx-dev-runtime)["']/,
    statt: "@solidjs/web, solid-js, @solidjs/h, @solidjs/html, @solidjs/universal",
  },
  { name: "lowercase event", muster: /\son[a-z]+=\{/, statt: "camelCase onClick" },
] as const;

/** A createEffect call whose first argument is followed directly by `)` – the 1.x single-function form */
const einteiligerEffekt = (text: string): number[] => {
  const zeilen: number[] = [];
  const muster = /\bcreateEffect\(/g;
  for (let treffer = muster.exec(text); treffer; treffer = muster.exec(text)) {
    let tiefe = 1;
    let i = treffer.index + treffer[0].length;
    let kommaAufErsterEbene = false;
    for (; i < text.length && tiefe > 0; i++) {
      const z = text[i];
      if (z === "(" || z === "{" || z === "[") tiefe++;
      else if (z === ")" || z === "}" || z === "]") tiefe--;
      else if (z === "," && tiefe === 1) kommaAufErsterEbene = true;
    }
    if (!kommaAufErsterEbene) zeilen.push(text.slice(0, treffer.index).split("\n").length);
  }
  return zeilen;
};

export type Fund = { datei: string; zeile: number; regel: string; statt: string };

/** The 1.x forms in one file's text; comments are left out so docs about a rule don't trip it */
export const pruefeText = (datei: string, text: string): Fund[] => {
  const ohneKommentare = text.replace(/\/\*[\s\S]*?\*\//g, (k) => k.replace(/[^\n]/g, " "));
  const zeilen = ohneKommentare.split("\n").map((z) => z.replace(/\/\/.*$/, ""));
  const funde: Fund[] = [];
  zeilen.forEach((zeile, i) => {
    for (const regel of REGELN) {
      if (regel.muster.test(zeile))
        funde.push({ datei, zeile: i + 1, regel: regel.name, statt: regel.statt });
    }
  });
  // the @once marker is itself a comment, so it is looked for in the raw text
  text.split("\n").forEach((zeile, i) => {
    if (/\/\*\s*@once\s*\*\//.test(zeile)) {
      funde.push({
        datei,
        zeile: i + 1,
        regel: "@once",
        statt: "reactive JSX, defaultValue or untrack",
      });
    }
  });
  for (const zeile of einteiligerEffekt(zeilen.join("\n"))) {
    funde.push({
      datei,
      zeile,
      regel: "createEffect with one function",
      statt: "createEffect(source, fn)",
    });
  }
  return funde;
};

const UEBERSPRUNGEN = new Set(["node_modules", "dist", "paraglide", "build-out"]);

const dateien = (ordner: string): string[] =>
  readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (UEBERSPRUNGEN.has(name)) return [];
    if (statSync(pfad).isDirectory()) return dateien(pfad);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".gen.ts") ? [pfad] : [];
  });

/** The client code: the web app and the UI package */
export const ORDNER = ["apps/web/src", "apps/web/build", "packages/ui/src"];

if (import.meta.main) {
  const wurzel = process.cwd();
  const funde = ORDNER.flatMap((o) => dateien(join(wurzel, o))).flatMap((d) =>
    pruefeText(relative(wurzel, d), readFileSync(d, "utf8")),
  );
  for (const f of funde)
    console.error(`${f.datei}:${f.zeile}  Solid 1.x (${f.regel}); use ${f.statt}`);
  if (funde.length > 0) {
    console.error(`\nsolid2: ${funde.length} 1.x form(s), see docs/solid-2.0/MIGRATION.md`);
    process.exit(1);
  }
  console.log("solid2: no Solid 1.x forms");
}

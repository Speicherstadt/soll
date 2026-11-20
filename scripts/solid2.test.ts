import { describe, expect, it } from "vitest";
import { pruefeText } from "./solid2.ts";

const regeln = (text: string) => pruefeText("x.tsx", text).map((f) => f.regel);

describe("the Solid 2.0 check (docs/solid-2.0/MIGRATION.md)", () => {
  it.each([
    ["const [u] = createResource(id, laden);", "createResource"],
    ["<Suspense fallback={x}>", "Suspense"],
    ['import { ErrorBoundary } from "solid-js";', "ErrorBoundary"],
    ["onMount(() => messen());", "onMount"],
    ["createEffect(on(count, (v) => log(v)));", "on helper"],
    ["batch(() => { a(1); b(2); });", "batch"],
    ["<div classList={{ aktiv: a() }} />", "classList"],
    ["<button use:tooltip={x} />", "namespace"],
    ["<div class:aktiv={a()} />", "namespace"],
    ["<Comp value={/*@once*/ props.v} />", "@once"],
    ["<Index each={liste()}>", "Index"],
    ["const p = mergeProps(a, b);", "mergeProps/splitProps"],
    ["setStore(produce((s) => { s.a = 1; }));", "store helpers"],
    ["startTransition(() => x());", "transitions"],
    ["<Theme.Provider value={t}>", "Provider"],
    ['import { render } from "solid-js/web";', "1.x imports"],
    ["<button onclick={plus} />", "lowercase event"],
    ["<Dynamic component={Editor} wert={w()} />", "Dynamic"],
  ])("finds %s", (text, regel) => {
    expect(regeln(text)).toContain(regel);
  });

  it("finds the single-function createEffect, also over several lines", () => {
    expect(regeln("createEffect(() => {\n  el.title = name();\n});")).toEqual([
      "createEffect with one function",
    ]);
  });

  it.each([
    "createEffect(\n  () => name(),\n  (wert) => { el.title = wert; },\n);",
    "createEffect(istPlaner, (planer) => { if (planer) laden(); });",
    '<div class={["karte", { aktiv: a() }]} onClick={() => x()} />',
    "<For each={liste()} keyed={false}>{(e) => <p>{e()}</p>}</For>",
    'import { render } from "@solidjs/web";',
    'const r = omit(props, "class");',
    "onSettled(() => messen());",
    "// createResource was 1.x",
    "/* <Suspense> is gone */",
    "const onlineSeit = 1; // an identifier that starts with on",
    "<img src={bild()} alt=\"\" onError={() => setKaputt(true)} />",
    "socket.on(ereignis, verarbeiten);",
    "const Aktiv = dynamic(() => (bearbeiten() ? Editor : Ansicht));",
  ])("leaves Solid 2.0 code alone: %s", (text) => {
    expect(regeln(text)).toEqual([]);
  });

  it("names file, line and the replacement", () => {
    expect(pruefeText("a.tsx", "ok\nonMount(f);")).toEqual([
      { datei: "a.tsx", zeile: 2, regel: "onMount", statt: "onSettled" },
    ]);
  });
});

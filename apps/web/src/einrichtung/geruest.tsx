import type { JSX } from "@solidjs/web";
import type { Module } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Kopf } from "../rahmen/karte.tsx";
import { Schrittfolge } from "../rahmen/schritte.tsx";
import { HINWEIS_TEXTE } from "./namen.ts";
import { hinweiseFuer, type Schritt } from "./schritte.ts";

const SCHRITT_NAMEN: Record<Schritt, () => string> = {
  betrieb: m.schritt_betrieb,
  standorte: m.schritt_standorte,
  arbeitszeit: m.schritt_arbeitszeit,
  mitarbeiter: m.schritt_mitarbeiter,
  einladungen: m.schritt_einladungen,
};

/** The steps as in the mockup: numbered pills, the current one marked for screen readers too */
const SchrittListe = (props: { schritte: Schritt[]; aktuell: number }) => (
  <Schrittfolge
    namen={props.schritte.map((schritt) => SCHRITT_NAMEN[schritt]())}
    aktuell={props.aktuell}
    beschriftung={m.einrichtung_schritte()}
  />
);

/** The hints beside the step, by the modules of the business */
const Hinweise = (props: { schritt: Schritt; module: Module }) => (
  <aside
    aria-labelledby="hinweise-titel"
    class="flex flex-[1_1_260px] flex-col gap-3 rounded-xl border border-border bg-background p-5"
  >
    <h2 id="hinweise-titel" class="font-semibold text-[15px]">
      {m.einrichtung_hinweise()}
    </h2>
    <ul class="flex flex-col gap-2">
      <For each={hinweiseFuer(props.schritt, props.module)}>
        {(hinweis) => <li class="rounded-lg bg-muted px-3 py-2.5">{HINWEIS_TEXTE[hinweis]()}</li>}
      </For>
    </ul>
  </aside>
);

/** The page of the setup: the steps, the current one in a card, the hints beside it */
export const Geruest = (props: {
  schritte: Schritt[];
  aktuell: number;
  module: Module;
  titelId: string;
  children: JSX.Element;
}) => (
  <main class="flex min-h-dvh justify-center bg-muted px-4 py-8 md:px-6 md:py-12">
    <div class="flex w-full max-w-[880px] flex-col gap-6">
      <Kopf titel={m.einrichtung_titel()} />
      <SchrittListe schritte={props.schritte} aktuell={props.aktuell} />
      <div class="flex flex-wrap items-start gap-6">
        <section
          aria-labelledby={props.titelId}
          class="flex min-w-0 flex-[999_1_420px] flex-col gap-4 rounded-xl border border-border bg-background p-4 md:p-6"
        >
          {props.children}
        </section>
        <Show when={props.schritte[props.aktuell]}>
          {(schritt) => <Hinweise schritt={schritt()} module={props.module} />}
        </Show>
      </div>
    </div>
  </main>
);

/** Title and line under it, at the top of each step */
export const SchrittKopf = (props: { id: string; titel: string; text: string }) => (
  <div class="flex flex-col gap-1">
    <h1 id={props.id} class="font-semibold text-[20px]">
      {props.titel}
    </h1>
    <p class="text-muted-foreground">{props.text}</p>
  </div>
);

/**
 * The foot of a step: where it stands, back, and on: "Weiter", or on the last step finishing the
 * setup. With `form` the button submits that form, so the browser checks its fields first. While
 * `arbeitet`, neither button leaves the step.
 */
export const Fuss = (props: {
  nummer: number;
  anzahl: number;
  zurueck?: (() => void) | undefined;
  weiter?: () => void;
  form?: string;
  arbeitet?: boolean;
}) => (
  <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
    <span class="text-muted-foreground">
      {m.einrichtung_stand({ nummer: props.nummer, anzahl: props.anzahl })}
    </span>
    <div class="flex gap-2">
      <Show when={props.zurueck}>
        {(zurueck) => (
          <Button variant="outline" size="lg" disabled={props.arbeitet} onClick={() => zurueck()()}>
            {m.einrichtung_zurueck()}
          </Button>
        )}
      </Show>
      <Button
        size="lg"
        type={props.form ? "submit" : "button"}
        form={props.form}
        disabled={props.arbeitet}
        onClick={() => props.weiter?.()}
      >
        {props.nummer === props.anzahl ? m.einrichtung_abschliessen() : m.einrichtung_weiter()}
      </Button>
    </div>
  </div>
);

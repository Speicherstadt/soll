import { Button } from "@soll/ui";
import { createSignal, For, Show } from "solid-js";
import { api } from "../api.ts";
import { GrundDialog } from "../monat/dialoge.tsx";
import { m } from "../paraglide/messages.js";
import { Karte } from "./karte.tsx";
import { type AbwesenheitQuelle, BASIS } from "./quelle.ts";
import { ART, FEHLER, tageText, tagText, zeitraumText } from "./text.ts";
import type { Abwesenheit } from "./typen.ts";

/** Refusing or cancelling needs a reason the person sees (BAULISTE.md S-401) */
export const GrundFuer = (props: {
  a: Abwesenheit & { name?: string };
  aktion: "ablehnen" | "stornieren";
  quelle: AbwesenheitQuelle;
  onSchliessen: () => void;
}) => (
  <GrundDialog
    titel={props.aktion === "ablehnen" ? m.abw_ablehnen_titel() : m.abw_stornieren_titel()}
    text={m.abw_grund_text({ name: props.a.name ?? "" })}
    knopf={props.aktion === "ablehnen" ? m.abw_ablehnen() : m.abw_stornieren()}
    senden={(_, grund) =>
      api(`${BASIS}/${props.a.abwesenheitId}/${props.aktion}`, { body: { grund } })
    }
    fehlerText={FEHLER}
    onSchliessen={props.onSchliessen}
    onGespeichert={() => void props.quelle.laden()}
  />
);

const Antrag = (props: { a: Abwesenheit; quelle: AbwesenheitQuelle }) => {
  const [ablehnen, setAblehnen] = createSignal(false);
  return (
    <li class="flex flex-wrap items-center justify-between gap-2 border-border border-t py-2 first:border-t-0">
      <span>
        <span class="font-medium">{props.a.name}</span> · {ART[props.a.art]()} ·{" "}
        {zeitraumText(props.a)}
        <Show when={props.a.urlaubHalbtage}>{(halbtage) => <> · {tageText(halbtage())}</>}</Show>
      </span>
      <div class="flex gap-2">
        <Button
          variant="outline"
          onClick={() =>
            void props.quelle.senden(
              api(`${BASIS}/${props.a.abwesenheitId}/freigeben`, { body: {} }),
              () => m.abw_freigegeben({ name: props.a.name ?? "" }),
            )
          }
        >
          {m.abw_freigeben()}
        </Button>
        <Button variant="outline" onClick={() => setAblehnen(true)}>
          {m.abw_ablehnen()}
        </Button>
      </div>
      <Show when={ablehnen()}>
        <GrundFuer
          a={props.a}
          aktion="ablehnen"
          quelle={props.quelle}
          onSchliessen={() => setAblehnen(false)}
        />
      </Show>
    </li>
  );
};

/** Requests waiting for owner or planner, and certificates the business should fetch (R-27) */
export const Offen = (props: { quelle: AbwesenheitQuelle }) => {
  const rechte = () => props.quelle.liste()?.rechte;
  return (
    <>
      <Show when={rechte()?.freigeben}>
        <Karte titel={m.abw_offen_titel()}>
          <Show
            when={(props.quelle.offen()?.antraege.length ?? 0) > 0}
            fallback={<p class="text-muted-foreground">{m.abw_offen_keine()}</p>}
          >
            <ul class="flex flex-col">
              <For each={props.quelle.offen()?.antraege ?? []}>
                {(a) => <Antrag a={a} quelle={props.quelle} />}
              </For>
            </ul>
          </Show>
        </Karte>
      </Show>
      <Show when={rechte()?.gesundheit && (props.quelle.offen()?.erinnerungen.length ?? 0) > 0}>
        <Karte titel={m.abw_erinnerungen_titel()}>
          <ul class="flex flex-col gap-1">
            <For each={props.quelle.offen()?.erinnerungen ?? []}>
              {(e) => (
                <li class={e.ueberfaellig ? "text-warning" : ""}>
                  {(e.ueberfaellig ? m.abw_erinnerung_ueberfaellig : m.abw_erinnerung)({
                    name: e.name,
                    von: tagText(e.von),
                    datum: tagText(e.faelligAm),
                  })}
                </li>
              )}
            </For>
          </ul>
        </Karte>
      </Show>
    </>
  );
};

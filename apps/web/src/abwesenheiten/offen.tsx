import { Badge, Button, Icon } from "@soll/ui";
import { Check } from "lucide";
import { createSignal, createUniqueId, For, Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { GrundDialog } from "../monat/dialoge.tsx";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Karte } from "./karte.tsx";
import { ABWESENHEIT_AENDERT, type AbwesenheitQuelle, BASIS } from "./quelle.ts";
import { ART, FEHLER, tageText, tagText, zeitraumText } from "./text.ts";
import type { Abwesenheit, Liste, Offen as OffeneListe } from "./typen.ts";

/** Refusing or cancelling needs a reason the person sees (BAULISTE.md S-401) */
export const GrundFuer = (props: {
  a: Abwesenheit & { name?: string };
  aktion: "ablehnen" | "stornieren";
  onSchliessen: () => void;
  onGespeichert: () => void;
}) => (
  <GrundDialog
    titel={props.aktion === "ablehnen" ? m.abw_ablehnen_titel() : m.abw_stornieren_titel()}
    text={m.abw_grund_text({ name: props.a.name ?? "" })}
    knopf={props.aktion === "ablehnen" ? m.abw_ablehnen() : m.abw_stornieren()}
    anfrage={(_, grund) => ({
      pfad: `${BASIS}/${props.a.abwesenheitId}/${props.aktion}`,
      body: { grund },
    })}
    fehlerText={FEHLER}
    betrifft={ABWESENHEIT_AENDERT}
    onSchliessen={props.onSchliessen}
    onGespeichert={props.onGespeichert}
  />
);

const Antrag = (props: { a: Abwesenheit; quelle: AbwesenheitQuelle }) => {
  const [ablehnen, setAblehnen] = createSignal(false);
  return (
    <li class="flex flex-wrap items-center justify-between gap-2 border-border border-t py-2.5 first:border-t-0">
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
              () => api(`${BASIS}/${props.a.abwesenheitId}/freigeben`, { body: {} }),
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
          onSchliessen={() => setAblehnen(false)}
          onGespeichert={props.quelle.geschafft}
        />
      </Show>
    </li>
  );
};

/** Requests waiting for owner or planner, and certificates the business should fetch (R-27) */
const OffeneKarten = (props: { quelle: AbwesenheitQuelle; rechte: Liste["rechte"] }) => {
  const offenId = createUniqueId();
  const offen = abfrage<OffeneListe>(ressourcen.abwesenheitenOffen);
  const stand = () => daten(offen.data);
  const antraege = () => stand()?.antraege ?? [];
  return (
    <Loading>
      <Fehler text={offen.data.ok ? "" : m.laden_fehler()} />
      <Show when={props.rechte.freigeben}>
        <Show
          when={antraege().length > 0}
          fallback={
            <section
              aria-labelledby={offenId}
              class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5"
            >
              <div class="flex items-center gap-2">
                <Icon icon={Check} class="size-4 text-success" />
                <h2 id={offenId} class="font-medium text-[13px] text-foreground">
                  {m.abw_offen_titel()}
                </h2>
              </div>
              <p class="text-[12px] text-muted-foreground">{m.abw_offen_keine()}</p>
            </section>
          }
        >
          <section
            aria-labelledby={offenId}
            class="flex flex-col gap-3 rounded-xl border border-warning/40 bg-background p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <h2 id={offenId} class="font-semibold">
                {m.abw_offen_titel()}
              </h2>
              <Badge ton="warning">{String(antraege().length)}</Badge>
            </div>
            <ul class="flex flex-col">
              <For each={antraege()}>{(a) => <Antrag a={a} quelle={props.quelle} />}</For>
            </ul>
          </section>
        </Show>
      </Show>
      <Show when={props.rechte.gesundheit && (stand()?.erinnerungen.length ?? 0) > 0}>
        <Karte titel={m.abw_erinnerungen_titel()}>
          <ul class="flex flex-col gap-1">
            <For each={stand()?.erinnerungen ?? []}>
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
    </Loading>
  );
};

/** Only who decides or sees sickness asks for what waits (abwesenheiten:freigeben, :gesundheit) */
export const Offen = (props: { quelle: AbwesenheitQuelle; rechte: Liste["rechte"] }) => (
  <Show when={props.rechte.freigeben || props.rechte.gesundheit}>
    <OffeneKarten quelle={props.quelle} rechte={props.rechte} />
  </Show>
);

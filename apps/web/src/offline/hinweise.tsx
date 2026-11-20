import { Icon } from "@soll/ui";
import { CircleAlert, CloudOff, TriangleAlert } from "lucide";
import { For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { ART_NAMEN, uhrzeitText } from "../zeiten/text.ts";
import type { Luecke } from "../zeiten/typen.ts";
import type { Eintrag } from "./warteschlange.ts";

/** A device as people read it: the start of its id is enough to tell two apart */
const geraetName = (geraetId: string) => geraetId.slice(0, 8);

/**
 * Heute without a network or with stamps not sent yet (S-305): how many wait, and that they go out
 * by themselves; read out when it appears
 */
export const WartendKarte = (props: { anzahl: number; ohneNetz: boolean }) => (
  <Show when={props.anzahl > 0 || props.ohneNetz}>
    <div
      role="status"
      class="flex items-start gap-2.5 rounded-xl border border-border bg-muted px-3.5 py-3"
    >
      <Icon icon={CloudOff} size={20} class="mt-px shrink-0 text-muted-foreground" />
      <div class="flex flex-col gap-0.5">
        <Show when={props.anzahl > 0} fallback={<span>{m.offline_ohne_netz()}</span>}>
          <span class="font-semibold text-[15px]" data-testid="wartend">
            {m.offline_wartend({ anzahl: String(props.anzahl) })}
          </span>
          <span class="text-[13px]">
            {props.ohneNetz ? m.offline_ohne_netz() : m.offline_wartend_text()}
          </span>
        </Show>
      </div>
    </div>
  </Show>
);

/** Entries the server refused: they stay in sight until the person adds them by hand */
export const AbgelehntListe = (props: { eintraege: Eintrag[] }) => (
  <Show when={props.eintraege.length > 0}>
    <section aria-labelledby="abgelehnt-titel" class="flex flex-col gap-2">
      <h2 id="abgelehnt-titel" class="font-semibold text-[13px] text-muted-foreground">
        {m.offline_abgelehnt_titel()}
      </h2>
      <ul class="flex flex-col gap-2">
        <For each={props.eintraege}>
          {(eintrag) => (
            <li class="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
              <Icon icon={TriangleAlert} class="mt-0.5 shrink-0 text-danger" />
              <span>
                {m.offline_abgelehnt({
                  art: ART_NAMEN[eintrag.art](),
                  uhrzeit: uhrzeitText(eintrag.geraetZeitpunkt),
                  nummer: String(eintrag.nummer),
                })}
              </span>
            </li>
          )}
        </For>
      </ul>
    </section>
  </Show>
);

/**
 * Numbers missing from a device of the person: a stamp may be lost, so the person and whoever reads
 * their times see it, with the duty to record it (§ 3 Abs. 2 Nr. 1 ArbSchG, as R-01)
 */
export const LueckenKarte = (props: { luecken: Luecke[] }) => (
  <Show when={props.luecken.length > 0}>
    <section
      aria-labelledby="luecken-titel"
      class="flex flex-col gap-1.5 rounded-xl border border-border px-3.5 py-3"
    >
      <h2 id="luecken-titel" class="flex items-center gap-2 font-semibold text-[15px]">
        <Icon icon={CircleAlert} size={20} class="shrink-0 text-warning" />
        {m.luecke_titel()}
      </h2>
      <ul class="flex flex-col">
        <For each={props.luecken}>
          {(luecke) => {
            // read in JSX: a row from a query follows its data
            const werte = () => ({
              geraet: geraetName(luecke.geraetId),
              von: String(luecke.von),
              bis: String(luecke.bis),
            });
            return (
              <li class="font-mono text-[13px] tabular-nums">
                {luecke.von === luecke.bis ? m.luecke_eine(werte()) : m.luecke_mehrere(werte())}
              </li>
            );
          }}
        </For>
      </ul>
      <p class="text-[13px]">{m.luecke_text()}</p>
      <p class="text-[12px] text-muted-foreground">
        {`${m.befund_hinweis()} · § 3 Abs. 2 Nr. 1 ArbSchG`}
      </p>
    </section>
  </Show>
);

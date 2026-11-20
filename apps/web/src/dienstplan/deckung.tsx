import type { Deckung } from "@soll/arbeitszeit";
import { Badge } from "@soll/ui";
import { For, Show } from "solid-js";
import { kurzerTag } from "../monat/text.ts";
import { m } from "../paraglide/messages.js";
import { spanneText } from "./text.ts";

/** One need on one day: covered, or how many people are missing, with what is planned */
const DeckungZeile = (props: { eintrag: Deckung }) => (
  <li
    class={`flex flex-wrap items-baseline gap-2.5 rounded-lg px-3 py-2 ${props.eintrag.fehlt > 0 ? "bg-warning-surface" : "bg-muted"}`}
  >
    <Show
      when={props.eintrag.fehlt > 0}
      fallback={<Badge ton="success">{m.plan_deckung_gedeckt()}</Badge>}
    >
      <span class="rounded-full border border-current px-2 py-0.5 font-semibold text-[12px] text-foreground">
        {m.plan_deckung_fehlt({ anzahl: props.eintrag.fehlt })}
      </span>
    </Show>
    <span class="flex-1">
      {kurzerTag(props.eintrag.tag)} · {props.eintrag.rolle}{" "}
      <span class="font-mono" dir="ltr">
        {spanneText(props.eintrag)}
      </span>{" "}
      · {m.plan_deckung_geplant({ geplant: props.eintrag.geplant, anzahl: props.eintrag.anzahl })}
    </span>
    <Show when={props.eintrag.offen > 0}>
      <span>{m.plan_deckung_offene({ anzahl: props.eintrag.offen })}</span>
    </Show>
  </li>
);

/**
 * The need of the week per role and how far the plan covers it (S-501), below the plan where the
 * mockup lists its notes; the color is never the only sign (DESIGN.md, "Farben")
 */
export const DeckungListe = (props: { deckung: readonly Deckung[] }) => {
  const fehlend = () => props.deckung.filter((eintrag) => eintrag.fehlt > 0).length;
  return (
    <Show when={props.deckung.length > 0}>
      <section aria-labelledby="deckung-titel" class="flex flex-col gap-2">
        <h2 id="deckung-titel" class="font-semibold text-[15px]">
          {m.plan_deckung_titel({ anzahl: fehlend() })}
        </h2>
        <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
          <For each={props.deckung} keyed={(eintrag) => `${eintrag.bedarfId}:${eintrag.tag}`}>
            {(eintrag) => <DeckungZeile eintrag={eintrag()} />}
          </For>
        </ul>
      </section>
    </Show>
  );
};

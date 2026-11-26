import type { Tagesstand } from "@soll/arbeitszeit";
import { Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { uhrzeitText } from "./text.ts";

const zustandText = (stand: Tagesstand): string => {
  if (stand.zustand === "arbeit" && stand.seit !== null)
    return m.stempeln_zustand_arbeit({ uhrzeit: uhrzeitText(stand.seit) });
  if (stand.zustand === "pause" && stand.seit !== null)
    return m.stempeln_zustand_pause({ uhrzeit: uhrzeitText(stand.seit) });
  return m.stempeln_zustand_aus();
};

const Wert = (props: { name: string; wert: string }) => (
  <div class="flex flex-col gap-0.5">
    <dt class="text-[12px] text-muted-foreground">{props.name}</dt>
    <dd class="font-mono text-[15px] tabular-nums">{props.wert}</dd>
  </div>
);

/**
 * The running day (design/mockup/Main.dc.html): the state with a dot that is never the only sign,
 * the time worked in large digits, and target, actual and break
 */
export const LaufenderTag = (props: { stand: Tagesstand; sollMinuten: number | null }) => (
  <section
    aria-label={m.tag_laufend()}
    class="flex flex-col gap-3 rounded-xl border border-border p-4"
  >
    <div class="flex items-center gap-2 text-[15px]">
      <span
        aria-hidden="true"
        class={`size-2.5 rounded-full ${
          props.stand.zustand === "arbeit"
            ? "bg-success"
            : props.stand.zustand === "pause"
              ? "bg-warning"
              : "bg-border"
        }`}
      />
      <span data-testid="zustand">{zustandText(props.stand)}</span>
    </div>
    <p class="font-mono font-semibold text-[40px] tabular-nums leading-none tracking-tight">
      <span class="sr-only">{`${m.tag_ist()}: `}</span>
      {dauerText(props.stand.istMinuten)}
    </p>
    <dl class="grid grid-cols-3 gap-2">
      <Wert
        name={m.tag_soll()}
        wert={props.sollMinuten === null ? m.soll_nicht_hinterlegt() : dauerText(props.sollMinuten)}
      />
      <Wert name={m.tag_ist()} wert={dauerText(props.stand.istMinuten)} />
      <Wert name={m.tag_pause()} wert={dauerText(props.stand.pausenMinuten)} />
    </dl>
    <Show when={props.stand.pausenabzugMinuten > 0}>
      <p class="text-[12px] text-muted-foreground">
        {m.pausenabzug_hinweis({ minuten: String(props.stand.pausenabzugMinuten) })}
      </p>
    </Show>
    <Show when={props.sollMinuten === null}>
      <p class="text-[12px] text-muted-foreground">{m.soll_nicht_hinterlegt_text()}</p>
    </Show>
  </section>
);

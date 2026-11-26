import type { JSX } from "@solidjs/web";
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
    <dd class="font-mono font-medium text-[15px] tabular-nums">{props.wert}</dd>
  </div>
);

/**
 * The running day Hero card on Heute: status pill, big worked time beside the primary stamp
 * actions on larger screens (stacked full-width on phones), subtle Ist/Soll progress bar, and
 * target, actual and break figures below.
 */
export const LaufenderTag = (props: {
  stand: Tagesstand;
  sollMinuten: number | null;
  aktionen?: JSX.Element;
}) => {
  const anteil = () => {
    const soll = props.sollMinuten;
    if (soll === null || soll <= 0) return null;
    return Math.min(100, Math.round((props.stand.istMinuten / soll) * 100));
  };
  const balkenFarbe = () => {
    if (props.stand.istMinuten > 600) return "bg-warning";
    if (props.sollMinuten !== null && props.stand.istMinuten >= props.sollMinuten)
      return "bg-success";
    return "bg-primary";
  };
  return (
    <section
      aria-label={m.tag_laufend()}
      class="flex flex-col gap-4 rounded-xl border border-border bg-background p-5"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex flex-col gap-2">
          <div class="inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-[13px]">
            <span
              aria-hidden="true"
              class={`size-2 shrink-0 rounded-full ${
                props.stand.zustand === "arbeit"
                  ? "bg-success"
                  : props.stand.zustand === "pause"
                    ? "bg-warning"
                    : "bg-muted-foreground/50"
              }`}
            />
            <span data-testid="zustand">{zustandText(props.stand)}</span>
          </div>
          <p class="font-mono font-semibold text-[42px] tabular-nums leading-none tracking-tight">
            <span class="sr-only">{`${m.tag_ist()}: `}</span>
            {dauerText(props.stand.istMinuten)}
          </p>
        </div>
        <Show when={props.aktionen}>
          {(aktionen) => (
            <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {aktionen()}
            </div>
          )}
        </Show>
      </div>
      <Show when={anteil() !== null}>
        <div aria-hidden="true" class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            class={`h-full rounded-full transition-all ${balkenFarbe()}`}
            style={{ width: `${anteil() ?? 0}%` }}
          />
        </div>
      </Show>
      <dl class="grid grid-cols-3 gap-3 border-t border-border pt-3">
        <Wert
          name={m.tag_soll()}
          wert={
            props.sollMinuten === null ? m.soll_nicht_hinterlegt() : dauerText(props.sollMinuten)
          }
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
};

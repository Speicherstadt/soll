import type { Tag } from "@soll/arbeitszeit";
import { Button, cn, Icon } from "@soll/ui";
import { Plus } from "lucide";
import { createMemo, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { befundeDer } from "./befunde.ts";
import { BefundIcon, befundeText, blockText } from "./block.tsx";
import { spanneText, tagDerZahl, tagLang, wochentagKurz } from "./text.ts";
import type { PlanBefund, Schicht, Vorlage, Woche, Ziel } from "./typen.ts";
import { planzeilen } from "./zeilen.ts";

/**
 * The plan on a phone, one day at a time (DESIGN.md, "Aufbau"): the seven days of the week as
 * buttons, then who works that day. Whoever plans opens a shift to change or move it, or adds one.
 */
export const TagListe = (props: {
  woche: Woche;
  vorlagen: readonly Vorlage[];
  planer: boolean;
  tag: Tag;
  onTag: (tag: Tag) => void;
  onOeffnen: (schicht: Schicht) => void;
  onNeu: (ziel: Ziel) => void;
}) => {
  const spalte = () => Math.max(0, props.woche.tage.indexOf(props.tag));
  const eintraege = createMemo(() =>
    planzeilen(props.woche, props.planer).flatMap((zeile) =>
      (zeile.zellen[spalte()] ?? []).map((schicht) => ({ zeile, schicht })),
    ),
  );
  return (
    <div class="flex flex-col gap-4">
      <fieldset class="m-0 grid grid-cols-7 gap-1 border-0 p-0">
        <legend class="sr-only">{m.plan_tag()}</legend>
        <For each={props.woche.tage}>
          {(tag) => (
            <button
              type="button"
              aria-pressed={tag === props.tag ? "true" : "false"}
              class={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-md border border-border text-[13px]",
                tag === props.tag && "border-foreground bg-accent font-semibold",
              )}
              onClick={() => props.onTag(tag)}
            >
              <span>{wochentagKurz(tag)}</span>
              <span class={tag === props.tag ? "" : "text-muted-foreground"}>
                {tagDerZahl(tag)}
              </span>
            </button>
          )}
        </For>
      </fieldset>
      <h2 class="font-semibold text-[17px]">{tagLang(props.tag)}</h2>
      <Show
        when={eintraege().length > 0}
        fallback={<p class="text-muted-foreground">{m.plan_tag_leer()}</p>}
      >
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          <For each={eintraege()}>
            {({ zeile, schicht }) => (
              <li>
                <Eintrag
                  name={zeile.name}
                  schicht={schicht}
                  vorlagen={props.vorlagen}
                  befunde={befundeDer(props.woche.befunde, schicht.schichtId)}
                  planer={props.planer}
                  onOeffnen={() => props.onOeffnen(schicht)}
                />
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.planer}>
        <Button
          variant="outline"
          size="lg"
          class="self-start"
          onClick={() => props.onNeu({ nutzerId: null, tag: props.tag })}
        >
          <Icon icon={Plus} size={20} />
          {m.plan_hinzufuegen()}
        </Button>
      </Show>
    </div>
  );
};

/**
 * One shift of the day: the person, the time, the label and, for whoever plans, its findings in
 * words (no tooltip on a phone); a button for whoever plans
 */
const Eintrag = (props: {
  name: string;
  schicht: Schicht;
  vorlagen: readonly Vorlage[];
  befunde: readonly PlanBefund[];
  planer: boolean;
  onOeffnen: () => void;
}) => {
  const inhalt = () => (
    <>
      <span class="font-medium">{props.name}</span>
      <span class="font-mono" dir="ltr">
        {spanneText(props.schicht)}
      </span>
      <span class="w-full">{blockText(props.schicht, props.vorlagen)}</span>
      <Show when={props.befunde.length > 0}>
        <span class="flex w-full items-start gap-1.5 text-[13px]">
          <BefundIcon befunde={props.befunde} />
          <span>{befundeText(props.befunde)}</span>
        </span>
      </Show>
    </>
  );
  // functions: an open shift may get a person and a finding may go when the week loads again
  const schwere = () => props.befunde[0]?.schwere;
  const klasse = () =>
    cn(
      "flex min-h-11 w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 text-start",
      props.schicht.nutzerId === null
        ? "border border-muted-foreground border-dashed"
        : schwere() === "verstoss"
          ? "border border-danger bg-accent"
          : schwere() === "hinweis"
            ? "border border-warning bg-accent"
            : "border border-border bg-accent",
    );
  return (
    <Show when={props.planer} fallback={<div class={klasse()}>{inhalt()}</div>}>
      <button type="button" class={klasse()} onClick={() => props.onOeffnen()}>
        {inhalt()}
      </button>
    </Show>
  );
};

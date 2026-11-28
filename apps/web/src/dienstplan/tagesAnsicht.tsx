import type { Tag } from "@soll/arbeitszeit";
import { Button, cn, Icon, Tooltip } from "@soll/ui";
import { Plus } from "lucide";
import { createMemo, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { befundeDer } from "./befunde.ts";
import { BefundIcon, befundeText, blockText, rahmenVon } from "./block.tsx";
import { tagMinuten } from "./farben.ts";
import { spanneText, tagDerZahl, tagLang, wochentagKurz } from "./text.ts";
import type { PlanBefund, Schicht, Vorlage, Woche, Ziel } from "./typen.ts";
import { planzeilen } from "./zeilen.ts";

const STUNDEN_STANDARD = { start: 6, ende: 22 };
const SCROLL_RAHMEN =
  "overflow-x-auto rounded-xl border border-border bg-background focus-visible:outline-2 focus-visible:outline-foreground";

const BalkenInhalt = (props: {
  schicht: Schicht;
  vorlagen: readonly Vorlage[];
  befunde: readonly PlanBefund[];
}) => (
  <>
    <span class="flex items-center justify-between gap-1">
      <span class="font-medium font-mono text-[11px]" dir="ltr">
        {spanneText(props.schicht)}
      </span>
      <BefundIcon befunde={props.befunde} />
    </span>
    <span class="truncate text-[11px] text-foreground/85">
      {blockText(props.schicht, props.vorlagen)}
    </span>
    <Show when={props.befunde.length > 0}>
      <span class="sr-only">{befundeText(props.befunde)}</span>
    </Show>
  </>
);

const TagesBalken = (props: {
  schicht: Schicht;
  vorlagen: readonly Vorlage[];
  befunde: readonly PlanBefund[];
  planer: boolean;
  stil: Record<string, string>;
  onOeffnen: () => void;
}) => {
  const rahmen = () => rahmenVon(props.schicht, props.vorlagen, props.befunde);
  const block = () => (
    <Show
      when={props.planer}
      fallback={
        <div
          class={cn(
            "flex h-full w-full flex-col justify-center overflow-hidden rounded-md px-2 text-start",
            rahmen(),
          )}
        >
          <BalkenInhalt schicht={props.schicht} vorlagen={props.vorlagen} befunde={props.befunde} />
        </div>
      }
    >
      <button
        type="button"
        class={cn(
          "flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden rounded-md px-2 text-start transition-colors focus-visible:outline-2 focus-visible:outline-foreground",
          rahmen(),
        )}
        onClick={() => props.onOeffnen()}
      >
        <BalkenInhalt schicht={props.schicht} vorlagen={props.vorlagen} befunde={props.befunde} />
      </button>
    </Show>
  );
  return (
    <div class="absolute top-1.5 bottom-1.5" style={props.stil}>
      <Show when={props.befunde.length > 0} fallback={block()}>
        <Tooltip text={befundeText(props.befunde)} class="block h-full w-full">
          {block()}
        </Tooltip>
      </Show>
    </div>
  );
};

/**
 * Day timeline view for Dienstplan: horizontal hourly grid per person with color-coded,
 * time-proportional shift bars so handovers, overlaps and coverage gaps are visible at a glance.
 */
export const TagesAnsicht = (props: {
  woche: Woche;
  vorlagen: readonly Vorlage[];
  planer: boolean;
  tag: Tag;
  onTag: (tag: Tag) => void;
  onOeffnen: (schicht: Schicht) => void;
  onNeu: (ziel: Ziel) => void;
}) => {
  const aktiverTag = () =>
    props.woche.tage.includes(props.tag) ? props.tag : (props.woche.tage[0] ?? props.tag);
  const zeilen = createMemo(() => planzeilen(props.woche, props.planer));
  const tagSchichten = createMemo(() =>
    props.woche.schichten.filter((s) => s.tag === aktiverTag()),
  );
  const stundenBereich = createMemo(() => {
    let start = STUNDEN_STANDARD.start;
    let ende = STUNDEN_STANDARD.ende;
    for (const s of tagSchichten()) {
      const a = Math.floor(tagMinuten(s.beginn) / 60);
      const bRaw = Math.ceil(tagMinuten(s.ende) / 60);
      const b = bRaw <= a ? 24 : bRaw;
      if (a < start) start = a;
      if (b > ende) ende = Math.min(24, b);
    }
    return { start, ende: Math.max(start + 1, ende) };
  });
  const stunden = createMemo(() => {
    const { start, ende } = stundenBereich();
    return Array.from({ length: ende - start + 1 }, (_, i) => start + i);
  });
  const balkenStil = (schicht: Schicht) => {
    const { start, ende } = stundenBereich();
    const gesamt = (ende - start) * 60;
    const von = Math.max(0, tagMinuten(schicht.beginn) - start * 60);
    const bisRoh = tagMinuten(schicht.ende);
    const bis = bisRoh <= tagMinuten(schicht.beginn) ? ende * 60 : bisRoh;
    const dauer = Math.max(30, bis - start * 60 - von);
    const links = Math.min(96, (von / gesamt) * 100);
    const breite = Math.min(100 - links, (dauer / gesamt) * 100);
    return {
      "inset-inline-start": `${links}%`,
      width: `${breite}%`,
    };
  };

  return (
    <div class="flex flex-col gap-3">
      <fieldset
        class="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0"
        aria-label={m.plan_ansicht_tag()}
        data-print-hidden=""
      >
        <For each={props.woche.tage}>
          {(tag) => {
            const aktiv = () => tag === aktiverTag();
            const anzahl = () => props.woche.schichten.filter((s) => s.tag === tag).length;
            return (
              <button
                type="button"
                aria-pressed={aktiv() ? "true" : "false"}
                aria-label={tagLang(tag)}
                onClick={() => props.onTag(tag)}
                class={cn(
                  "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-foreground md:min-h-8",
                  aktiv()
                    ? "border-foreground bg-foreground font-medium text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <span>
                  {wochentagKurz(tag)} {tagDerZahl(tag)}
                </span>
                <span
                  class={cn(
                    "rounded-full px-1.5 font-mono text-[11px] tabular-nums",
                    aktiv() ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
                  )}
                >
                  {anzahl()}
                </span>
              </button>
            );
          }}
        </For>
      </fieldset>

      <div tabindex={0} class={SCROLL_RAHMEN}>
        <div class="min-w-[780px]">
          <div class="grid grid-cols-[170px_1fr] border-border border-b bg-muted/40">
            <div class="px-3 py-2 font-semibold text-[12px] text-muted-foreground">
              {m.plan_person()}
            </div>
            <div class="relative h-8">
              <For each={stunden().slice(0, -1)}>
                {(stunde, idx) => (
                  <span
                    class="absolute top-2 font-mono text-[11px] text-muted-foreground tabular-nums"
                    style={{
                      "inset-inline-start": `${(idx() / (stunden().length - 1)) * 100}%`,
                    }}
                    dir="ltr"
                  >
                    {String(stunde).padStart(2, "0")}:00
                  </span>
                )}
              </For>
            </div>
          </div>

          <For each={zeilen()} keyed={(z) => z.nutzerId ?? ""}>
            {(zeile) => {
              const schichten = () => tagSchichten().filter((s) => s.nutzerId === zeile().nutzerId);
              const ziel = (): Ziel => ({ nutzerId: zeile().nutzerId, tag: aktiverTag() });
              return (
                <div class="grid grid-cols-[170px_1fr] border-border border-b last:border-b-0">
                  <div class="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div class="min-w-0">
                      <div class="truncate font-medium text-[13px]">{zeile().name}</div>
                      <Show when={zeile().unter}>
                        <div class="truncate text-[11px] text-muted-foreground">
                          {zeile().unter}
                        </div>
                      </Show>
                    </div>
                    <Show when={props.planer}>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={m.plan_hinzufuegen_fuer({
                          ort: m.plan_ort({ name: zeile().name, tag: tagLang(aktiverTag()) }),
                        })}
                        class="shrink-0"
                        onClick={() => props.onNeu(ziel())}
                      >
                        <Icon icon={Plus} />
                      </Button>
                    </Show>
                  </div>
                  <div class="relative min-h-14 border-border border-s">
                    <For each={stunden().slice(1, -1)}>
                      {(_, idx) => (
                        <div
                          aria-hidden="true"
                          class="pointer-events-none absolute inset-y-0 border-border/50 border-s"
                          style={{
                            "inset-inline-start": `${((idx() + 1) / (stunden().length - 1)) * 100}%`,
                          }}
                        />
                      )}
                    </For>
                    <For each={schichten()} keyed={(s) => s.schichtId}>
                      {(schicht) => (
                        <TagesBalken
                          schicht={schicht()}
                          vorlagen={props.vorlagen}
                          befunde={befundeDer(props.woche.befunde, schicht().schichtId)}
                          planer={props.planer}
                          stil={balkenStil(schicht())}
                          onOeffnen={() => props.onOeffnen(schicht())}
                        />
                      )}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
};

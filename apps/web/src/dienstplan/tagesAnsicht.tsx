import type { Tag } from "@soll/arbeitszeit";
import { Button, cn, Icon } from "@soll/ui";
import { Plus } from "lucide";
import { createMemo, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { befundeDer } from "./befunde.ts";
import { BefundIcon, blockText } from "./block.tsx";
import { schichtFarbe, tagMinuten } from "./farben.ts";
import { spanneText, tagDerZahl, tagLang, wochentagKurz } from "./text.ts";
import type { Schicht, Vorlage, Woche, Ziel } from "./typen.ts";
import { planzeilen } from "./zeilen.ts";

const STUNDEN_STANDARD = { start: 6, ende: 22 };

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
  const spalteIndex = () => Math.max(0, props.woche.tage.indexOf(aktiverTag()));
  const zeilen = createMemo(() => planzeilen(props.woche, props.planer));

  const tagSchichten = createMemo(() =>
    props.woche.schichten.filter((s) => s.tag === aktiverTag()),
  );

  const bereich = createMemo(() => {
    let start = STUNDEN_STANDARD.start;
    let ende = STUNDEN_STANDARD.ende;
    for (const s of tagSchichten()) {
      const b = Math.floor(tagMinuten(s.beginn) / 60);
      const e = Math.ceil((tagMinuten(s.beginn) + (s.ende - s.beginn) / 60_000) / 60);
      if (b < start) start = Math.max(0, b);
      if (e > ende) ende = Math.min(24, e);
    }
    return { start, ende, spanne: Math.max(1, (ende - start) * 60) };
  });

  const stunden = createMemo(() => {
    const { start, ende } = bereich();
    return Array.from({ length: ende - start + 1 }, (_, i) => start + i);
  });

  const balkenStil = (s: Schicht) => {
    const { start, spanne } = bereich();
    const von = Math.max(0, tagMinuten(s.beginn) - start * 60);
    const dauerMin = Math.max(30, (s.ende - s.beginn) / 60_000);
    const links = Math.min(96, (von / spanne) * 100);
    const breite = Math.min(100 - links, (dauerMin / spanne) * 100);
    return { "inset-inline-start": `${links}%`, width: `${breite}%` };
  };

  return (
    <div class="flex flex-col gap-3">
      <fieldset
        class="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0"
        aria-label={m.plan_ansicht_tag()}
      >
        <For each={props.woche.tage}>
          {(tag) => {
            const aktiv = () => tag === aktiverTag();
            const anzahl = () => props.woche.schichten.filter((s) => s.tag === tag).length;
            return (
              <button
                type="button"
                aria-pressed={aktiv() ? "true" : "false"}
                class={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors",
                  aktiv()
                    ? "border-foreground bg-foreground text-background font-medium"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
                onClick={() => props.onTag(tag)}
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

      <div class="overflow-x-auto rounded-xl border border-border bg-background">
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
              const schichten = () => zeile().zellen[spalteIndex()] ?? [];
              const ziel = (): Ziel => ({ nutzerId: zeile().nutzerId, tag: aktiverTag() });
              return (
                <div class="grid grid-cols-[170px_1fr] border-border border-b last:border-0">
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
                      {(schicht) => {
                        const befunde = () => befundeDer(props.woche.befunde, schicht().schichtId);
                        const farbe = () => schichtFarbe(schicht(), props.vorlagen);
                        const inhalt = () => (
                          <>
                            <span class="flex items-center justify-between gap-1">
                              <span class="font-mono text-[11px] font-medium" dir="ltr">
                                {spanneText(schicht())}
                              </span>
                              <BefundIcon befunde={befunde()} />
                            </span>
                            <span class="truncate text-[11px] text-muted-foreground">
                              {blockText(schicht(), props.vorlagen)}
                            </span>
                          </>
                        );
                        return (
                          <Show
                            when={props.planer}
                            fallback={
                              <div
                                class={cn(
                                  "absolute top-1.5 bottom-1.5 flex flex-col justify-center overflow-hidden rounded-md px-2 text-start",
                                  farbe().karte,
                                )}
                                style={balkenStil(schicht())}
                              >
                                {inhalt()}
                              </div>
                            }
                          >
                            <button
                              type="button"
                              class={cn(
                                "absolute top-1.5 bottom-1.5 flex cursor-pointer flex-col justify-center overflow-hidden rounded-md px-2 text-start transition-colors focus-visible:outline-2 focus-visible:outline-foreground",
                                farbe().karte,
                              )}
                              style={balkenStil(schicht())}
                              onClick={() => props.onOeffnen(schicht())}
                            >
                              {inhalt()}
                            </button>
                          </Show>
                        );
                      }}
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

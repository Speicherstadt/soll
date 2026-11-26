import { createMemo, createSignal, For, Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { uhrzeitText } from "./text.ts";
import type { Stempel } from "./typen.ts";
import { type ZeitstrahlSegment, zeitstrahlSegmente } from "./zeitstrahlSegmente.ts";

const segmentLabel = (segment: ZeitstrahlSegment): string =>
  `${uhrzeitText(segment.beginn)}–${uhrzeitText(segment.ende)} · ${
    segment.art === "arbeit" ? m.zeitstrahl_arbeit() : m.tag_pause()
  } · ${dauerText(segment.minuten)}`;

/**
 * Interactive visual day timeline on Zeiten: shows work and break segments proportionally across
 * the day's span with RTL-safe positioning, clamped widths, 44px mobile touch targets, and
 * hover/focus/click inspection.
 */
export const TagesZeitstrahl = (props: { stempelungen: readonly Stempel[]; jetzt: number }) => {
  const segmente = createMemo(() => zeitstrahlSegmente(props.stempelungen, props.jetzt));
  const [aktiv, setAktiv] = createSignal<number | null>(null);
  const spanne = createMemo(() => {
    const liste = segmente();
    const erster = liste[0];
    const letzter = liste.at(-1);
    if (!erster || !letzter) return null;
    const gesamt = Math.max(1, letzter.ende - erster.beginn);
    return { anfang: erster.beginn, ende: letzter.ende, gesamt };
  });
  const ausgewaehlt = () => {
    const index = aktiv();
    return index === null ? null : (segmente()[index] ?? null);
  };
  return (
    <Show when={spanne()}>
      {(bereich) => (
        <section
          aria-label={m.tag_zeitstrahl()}
          class="flex flex-col gap-2 rounded-xl border border-border bg-background p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-semibold text-[13px] text-muted-foreground">{m.tag_zeitstrahl()}</h2>
            <Show
              when={ausgewaehlt()}
              fallback={
                <div class="flex items-center gap-3 text-[12px] text-muted-foreground">
                  <span class="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" class="size-2.5 rounded-xs bg-primary" />
                    {m.zeitstrahl_arbeit()}
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" class="size-2.5 rounded-xs bg-warning" />
                    {m.tag_pause()}
                  </span>
                </div>
              }
            >
              {(segment) => (
                <span class="font-mono text-[12px] text-foreground tabular-nums">
                  {segmentLabel(segment())}
                </span>
              )}
            </Show>
          </div>
          <div class="relative flex h-11 w-full items-center overflow-hidden md:h-8">
            <div aria-hidden="true" class="h-5 w-full rounded-lg bg-muted" />
            <For each={segmente()}>
              {(segment, index) => {
                const breite = () =>
                  Math.min(
                    100,
                    Math.max(1.5, ((segment.ende - segment.beginn) / bereich().gesamt) * 100),
                  );
                const start = () =>
                  Math.min(
                    100 - breite(),
                    ((segment.beginn - bereich().anfang) / bereich().gesamt) * 100,
                  );
                const label = () => segmentLabel(segment);
                return (
                  <button
                    type="button"
                    aria-label={label()}
                    title={label()}
                    class="absolute inset-y-0 flex items-center outline-hidden focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid"
                    style={{ "inset-inline-start": `${start()}%`, width: `${breite()}%` }}
                    onMouseEnter={() => setAktiv(index())}
                    onMouseLeave={() => setAktiv(null)}
                    onFocus={() => setAktiv(index())}
                    onBlur={() => setAktiv(null)}
                    onClick={() => setAktiv((vorher) => (vorher === index() ? null : index()))}
                  >
                    <span
                      class={[
                        "block h-5 w-full rounded-sm transition-opacity",
                        segment.art === "arbeit" ? "bg-primary" : "bg-warning",
                        aktiv() !== null && aktiv() !== index() ? "opacity-55" : "opacity-100",
                      ]}
                    />
                  </button>
                );
              }}
            </For>
          </div>
          <div class="flex items-center justify-between font-mono text-[12px] text-muted-foreground tabular-nums">
            <span>{uhrzeitText(bereich().anfang)}</span>
            <span>{uhrzeitText(bereich().ende)}</span>
          </div>
        </section>
      )}
    </Show>
  );
};

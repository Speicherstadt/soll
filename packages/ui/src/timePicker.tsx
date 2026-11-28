import { ChevronDown, ChevronUp, Clock } from "lucide";
import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  onSettled,
  Show,
  untrack,
} from "solid-js";
import { cn } from "./cn.ts";
import { Icon } from "./icon.tsx";
import {
  einheitName,
  minuteDrehen,
  stundeDrehen,
  VIERTEL_MINUTEN,
  zeitFormatieren,
  zeitTeilen,
} from "./pickerDaten.ts";
import { verankert } from "./popover.tsx";

export type TimePickerProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  class?: string;
  onValue?: (wert: string) => void;
};

const aktuelleSprache = () =>
  (typeof document !== "undefined" && document.documentElement.lang) || "de";

const SCHRITT_KNOPF =
  "inline-flex h-10 md:h-7 w-full cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground";

const ZeitPopover = (props: {
  id: string;
  anker: string;
  offen: boolean;
  sprache: string;
  teile: { stunde: number; minute: number } | null;
  ref: (el: HTMLDivElement) => void;
  onZeit: (stunde: number, minute: number) => void;
}) => {
  const stunde = () => props.teile?.stunde ?? 8;
  const minute = () => props.teile?.minute ?? 0;
  const stundeLabel = () => einheitName("hour", props.sprache);
  const minuteLabel = () => einheitName("minute", props.sprache);

  return (
    <div
      id={props.id}
      ref={props.ref}
      popover="manual"
      data-picker-popover={props.offen ? "time" : undefined}
      style={verankert(props.anker)}
      class="w-[220px] overscroll-contain rounded-xl border border-border bg-background p-3 text-foreground shadow-xl md:w-[204px]"
    >
      <Show when={props.offen}>
        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div class="flex flex-col items-center gap-1">
            <button
              type="button"
              aria-label={`${stundeLabel()} +1`}
              class={SCHRITT_KNOPF}
              onClick={() => props.onZeit(stundeDrehen(stunde(), 1), minute())}
            >
              <Icon icon={ChevronUp} size={15} />
            </button>
            <span class="flex h-10 w-full items-center justify-center rounded-md border border-border bg-muted/40 font-mono font-semibold text-[18px] tabular-nums">
              {String(stunde()).padStart(2, "0")}
            </span>
            <button
              type="button"
              aria-label={`${stundeLabel()} -1`}
              class={SCHRITT_KNOPF}
              onClick={() => props.onZeit(stundeDrehen(stunde(), -1), minute())}
            >
              <Icon icon={ChevronDown} size={15} />
            </button>
          </div>

          <span class="font-mono font-semibold text-[18px] text-muted-foreground">:</span>

          <div class="flex flex-col items-center gap-1">
            <button
              type="button"
              aria-label={`${minuteLabel()} +1`}
              class={SCHRITT_KNOPF}
              onClick={() => props.onZeit(stunde(), minuteDrehen(minute(), 1))}
            >
              <Icon icon={ChevronUp} size={15} />
            </button>
            <span class="flex h-10 w-full items-center justify-center rounded-md border border-border bg-muted/40 font-mono font-semibold text-[18px] tabular-nums">
              {String(minute()).padStart(2, "0")}
            </span>
            <button
              type="button"
              aria-label={`${minuteLabel()} -1`}
              class={SCHRITT_KNOPF}
              onClick={() => props.onZeit(stunde(), minuteDrehen(minute(), -1))}
            >
              <Icon icon={ChevronDown} size={15} />
            </button>
          </div>
        </div>

        <div class="mt-2.5 grid grid-cols-4 gap-1 border-border border-t pt-2.5">
          <For each={VIERTEL_MINUTEN}>
            {(min) => {
              const aktiv = () => props.teile?.minute === min;
              return (
                <button
                  type="button"
                  aria-pressed={aktiv() ? "true" : "false"}
                  class={cn(
                    "h-10 cursor-pointer rounded-md font-mono text-[12px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-foreground md:h-7",
                    aktiv()
                      ? "bg-foreground font-semibold text-background"
                      : "border border-control-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => props.onZeit(stunde(), min)}
                >
                  :{String(min).padStart(2, "0")}
                </button>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

const zeitEreignisse = (
  offen: () => boolean,
  schliessen: () => void,
  huelle: () => HTMLDivElement | undefined,
  input: () => HTMLInputElement | undefined,
  beiReset: () => void,
) => {
  onSettled(() => {
    const beiKlick = (e: PointerEvent) => {
      if (offen() && huelle() && !huelle()?.contains(e.target as Node)) schliessen();
    };
    const beiEsc = (e: KeyboardEvent) => {
      if (!offen() || e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      schliessen();
      input()?.focus();
    };
    document.addEventListener("pointerdown", beiKlick);
    document.addEventListener("keydown", beiEsc, true);
    const formular = input()?.form;
    formular?.addEventListener("reset", beiReset);
    return () => {
      document.removeEventListener("pointerdown", beiKlick);
      document.removeEventListener("keydown", beiEsc, true);
      formular?.removeEventListener("reset", beiReset);
    };
  });
};

/**
 * Shadcn-style TimePicker: clean monospace HH:MM input paired with a top-layer Popover API
 * hour/minute stepper (+ quarter-hour quick-pick pills) and direct keyboard typing.
 */
export const TimePicker = (props: TimePickerProps) => {
  const popoverId = createUniqueId();
  const anker = `--time-${popoverId}`;
  const [intern, setIntern] = createSignal(untrack(() => props.value ?? props.defaultValue ?? ""));
  const [offen, setOffen] = createSignal(false);
  const aktuell = () => (props.value !== undefined ? props.value : intern());
  const teile = () => zeitTeilen(aktuell());

  let huelleRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;
  let popoverRef: HTMLDivElement | undefined;

  const setzeOffen = (auf: boolean) => {
    if (auf && props.disabled) return;
    setOffen(auf);
    if (auf && !popoverRef?.matches(":popover-open")) popoverRef?.showPopover();
    if (!auf && popoverRef?.matches(":popover-open")) popoverRef.hidePopover();
  };

  zeitEreignisse(
    offen,
    () => setzeOffen(false),
    () => huelleRef,
    () => inputRef,
    () => {
      const standard = props.defaultValue ?? "";
      setIntern(standard);
      if (inputRef && props.value === undefined) inputRef.defaultValue = standard;
    },
  );

  createEffect(
    () => props.defaultValue,
    (standard) => {
      if (inputRef && props.value === undefined) inputRef.defaultValue = standard ?? "";
    },
  );

  const uebernehmen = (neu: string) => {
    setIntern(neu);
    if (inputRef) inputRef.value = neu;
    props.onValue?.(neu);
  };

  const sprache = () => aktuelleSprache();
  const zeitLabel = () => `${einheitName("hour", sprache())} / ${einheitName("minute", sprache())}`;

  return (
    <div ref={huelleRef} style={{ "anchor-name": anker }} class={cn("relative", props.class)}>
      <input
        ref={(el) => {
          inputRef = el;
          if (props.value === undefined) el.defaultValue = props.defaultValue ?? "";
        }}
        id={props.id}
        name={props.name}
        type="text"
        inputmode="numeric"
        autocomplete="off"
        required={props.required}
        disabled={props.disabled}
        placeholder={props.placeholder ?? "HH:MM"}
        value={aktuell()}
        dir="ltr"
        class="h-9 w-full rounded-md border border-control-border bg-background ps-3 pe-9 font-mono text-[13px] tabular-nums outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onInput={(e) => {
          const wert = e.currentTarget.value;
          setIntern(wert);
          props.onValue?.(wert);
        }}
        onClick={() => setzeOffen(true)}
      />
      <button
        type="button"
        disabled={props.disabled}
        aria-label={zeitLabel()}
        aria-expanded={offen() ? "true" : "false"}
        aria-controls={popoverId}
        class="absolute end-1 top-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onClick={() => setzeOffen(!offen())}
      >
        <Icon icon={Clock} size={14} />
      </button>
      <ZeitPopover
        id={popoverId}
        anker={anker}
        offen={offen()}
        ref={(el) => {
          popoverRef = el;
        }}
        sprache={sprache()}
        teile={teile()}
        onZeit={(h, min) => uebernehmen(zeitFormatieren(h, min))}
      />
    </div>
  );
};

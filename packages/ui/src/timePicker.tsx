import { ChevronDown, ChevronUp, Clock } from "lucide";
import { createEffect, createSignal, For, onSettled, Show, untrack } from "solid-js";
import { cn } from "./cn.ts";
import { Icon } from "./icon.tsx";
import {
  minuteDrehen,
  popoverPosition,
  stundeDrehen,
  VIERTEL_MINUTEN,
  zeitFormatieren,
  zeitTeilen,
} from "./pickerDaten.ts";

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

const POPOVER_BREITE = 204;
const POPOVER_HOEHE = 176;

const SCHRITT_KNOPF =
  "inline-flex h-7 w-full cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground";

const ZeitPopover = (props: {
  pos: { top: number; left: number };
  teile: { stunde: number; minute: number } | null;
  onZeit: (stunde: number, minute: number) => void;
}) => {
  const stunde = () => props.teile?.stunde ?? 8;
  const minute = () => props.teile?.minute ?? 0;

  return (
    <div
      data-picker-popover="time"
      style={{ top: `${props.pos.top}px`, left: `${props.pos.left}px` }}
      class="fixed z-50 w-[204px] rounded-xl border border-border bg-background p-3 shadow-xl"
    >
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div class="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="+01:00"
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
            aria-label="-01:00"
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
            aria-label="+00:01"
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
            aria-label="-00:01"
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
                class={cn(
                  "h-7 cursor-pointer rounded-md font-mono text-[12px] tabular-nums transition-colors",
                  aktiv()
                    ? "bg-foreground font-semibold text-background"
                    : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => props.onZeit(stunde(), min)}
              >
                :{String(min).padStart(2, "0")}
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
};

/**
 * Shadcn-style TimePicker: clean monospace HH:MM input paired with a compact scrollbar-free
 * hour/minute stepper popover (+ quarter-hour quick-pick pills) and direct keyboard typing.
 */
export const TimePicker = (props: TimePickerProps) => {
  const [intern, setIntern] = createSignal(untrack(() => props.value ?? props.defaultValue ?? ""));
  const [offen, setOffen] = createSignal(false);
  const [pos, setPos] = createSignal({ top: 0, left: 0 });
  const aktuell = () => (props.value !== undefined ? props.value : intern());
  const teile = () => zeitTeilen(aktuell());

  let huelleRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const positionMessen = () => {
    if (!huelleRef || typeof window === "undefined") return;
    setPos(
      popoverPosition(
        huelleRef.getBoundingClientRect(),
        POPOVER_BREITE,
        POPOVER_HOEHE,
        window.innerWidth,
        window.innerHeight,
      ),
    );
  };

  onSettled(() => {
    const schliessenBeiKlick = (e: MouseEvent) => {
      if (offen() && huelleRef && !huelleRef.contains(e.target as Node)) setOffen(false);
    };
    const schliessenBeiEsc = (e: KeyboardEvent) => {
      if (!offen() || e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOffen(false);
    };
    const beiVersatz = () => {
      if (offen()) positionMessen();
    };
    document.addEventListener("mousedown", schliessenBeiKlick);
    document.addEventListener("keydown", schliessenBeiEsc, true);
    window.addEventListener("resize", beiVersatz);
    window.addEventListener("scroll", beiVersatz, true);

    const formular = inputRef?.form;
    const beiReset = () => {
      const standard = props.defaultValue ?? "";
      setIntern(standard);
      if (inputRef && props.value === undefined) inputRef.defaultValue = standard;
    };
    formular?.addEventListener("reset", beiReset);

    return () => {
      document.removeEventListener("mousedown", schliessenBeiKlick);
      document.removeEventListener("keydown", schliessenBeiEsc, true);
      window.removeEventListener("resize", beiVersatz);
      window.removeEventListener("scroll", beiVersatz, true);
      formular?.removeEventListener("reset", beiReset);
    };
  });

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

  const oeffnen = (erzwingen?: boolean) => {
    if (props.disabled) return;
    const naechst = erzwingen ?? !offen();
    if (naechst) positionMessen();
    setOffen(naechst);
  };

  return (
    <div ref={huelleRef} class={cn("relative", props.class)}>
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
        class="h-9 w-full rounded-md border border-border bg-background ps-3 pe-9 font-mono text-[13px] tabular-nums outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onInput={(e) => {
          const wert = e.currentTarget.value;
          setIntern(wert);
          props.onValue?.(wert);
        }}
        onClick={() => oeffnen(true)}
      />
      <button
        type="button"
        disabled={props.disabled}
        aria-label={aktuell() || "00:00"}
        aria-expanded={offen() ? "true" : "false"}
        class="absolute end-1 top-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onClick={() => oeffnen()}
      >
        <Icon icon={Clock} size={14} />
      </button>

      <Show when={offen()}>
        <ZeitPopover
          pos={pos()}
          teile={teile()}
          onZeit={(h, min) => uebernehmen(zeitFormatieren(h, min))}
        />
      </Show>
    </div>
  );
};

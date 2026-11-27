import { Clock } from "lucide";
import { createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { cn } from "./cn.ts";
import { Icon } from "./icon.tsx";
import { MINUTEN, popoverPosition, STUNDEN, zeitFormatieren, zeitTeilen } from "./pickerDaten.ts";

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

const POPOVER_BREITE = 196;
const POPOVER_HOEHE = 224;

/**
 * Shadcn-style TimePicker: clean monospace HH:MM input paired with a 2-column hour/minute popover
 * (00..23 × 00..55 in 5-min steps) plus direct keyboard typing for any exact minute.
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
  if (typeof document !== "undefined") {
    document.addEventListener("mousedown", schliessenBeiKlick);
    document.addEventListener("keydown", schliessenBeiEsc, true);
    window.addEventListener("resize", beiVersatz);
    window.addEventListener("scroll", beiVersatz, true);
    onCleanup(() => {
      document.removeEventListener("mousedown", schliessenBeiKlick);
      document.removeEventListener("keydown", schliessenBeiEsc, true);
      window.removeEventListener("resize", beiVersatz);
      window.removeEventListener("scroll", beiVersatz, true);
    });
  }

  const uebernehmen = (neu: string) => {
    setIntern(neu);
    if (inputRef && inputRef.value !== neu) {
      inputRef.value = neu;
      inputRef.dispatchEvent(new Event("input", { bubbles: true }));
      inputRef.dispatchEvent(new Event("change", { bubbles: true }));
    }
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
          const formular = el.form;
          if (!formular) return;
          const beiReset = () => setIntern(props.defaultValue ?? "");
          formular.addEventListener("reset", beiReset);
          onCleanup(() => formular.removeEventListener("reset", beiReset));
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
        onChange={(e) => {
          const wert = e.currentTarget.value;
          setIntern(wert);
          props.onValue?.(wert);
        }}
        onClick={() => oeffnen(true)}
      />
      <button
        type="button"
        disabled={props.disabled}
        aria-label="Time"
        aria-expanded={offen() ? "true" : "false"}
        class="absolute end-1 top-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onClick={() => oeffnen()}
      >
        <Icon icon={Clock} size={14} />
      </button>

      <Show when={offen()}>
        <div
          data-picker-popover="time"
          style={{ top: `${pos().top}px`, left: `${pos().left}px` }}
          class="fixed z-50 grid w-[196px] grid-cols-2 gap-1.5 rounded-xl border border-border bg-background p-2 shadow-lg"
        >
          <div class="flex max-h-52 flex-col gap-0.5 overflow-y-auto pe-1">
            <For each={STUNDEN}>
              {(h) => {
                const aktiv = () => teile()?.stunde === h;
                return (
                  <button
                    type="button"
                    class={cn(
                      "cursor-pointer rounded-md px-2 py-1 text-center font-mono text-[12px] tabular-nums transition-colors",
                      aktiv()
                        ? "bg-foreground font-semibold text-background"
                        : "text-foreground hover:bg-muted",
                    )}
                    onClick={() => uebernehmen(zeitFormatieren(h, teile()?.minute ?? 0))}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                );
              }}
            </For>
          </div>
          <div class="flex max-h-52 flex-col gap-0.5 overflow-y-auto border-border border-s ps-1.5">
            <For each={MINUTEN}>
              {(min) => {
                const aktiv = () => teile()?.minute === min;
                return (
                  <button
                    type="button"
                    class={cn(
                      "cursor-pointer rounded-md px-2 py-1 text-center font-mono text-[12px] tabular-nums transition-colors",
                      aktiv()
                        ? "bg-foreground font-semibold text-background"
                        : "text-foreground hover:bg-muted",
                    )}
                    onClick={() => {
                      uebernehmen(zeitFormatieren(teile()?.stunde ?? 8, min));
                      setOffen(false);
                    }}
                  >
                    {String(min).padStart(2, "0")}
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

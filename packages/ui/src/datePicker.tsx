import { Calendar, ChevronLeft, ChevronRight } from "lucide";
import { createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { cn } from "./cn.ts";
import { Icon } from "./icon.tsx";
import {
  heuteIso,
  ISO_DATUM,
  kalenderGitter,
  monatVerschieben,
  popoverPosition,
} from "./pickerDaten.ts";

export type DatePickerProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  class?: string;
  onValue?: (wert: string) => void;
};

const POPOVER_BREITE = 268;
const POPOVER_HOEHE = 304;

const aktuelleSprache = () =>
  (typeof document !== "undefined" && document.documentElement.lang) || "de";

/**
 * Shadcn-style DatePicker: clean text input (YYYY-MM-DD, compatible with keyboard typing,
 * FormData and Playwright fill) paired with a dark/light calendar popover.
 */
export const DatePicker = (props: DatePickerProps) => {
  const [intern, setIntern] = createSignal(untrack(() => props.value ?? props.defaultValue ?? ""));
  const [offen, setOffen] = createSignal(false);
  const [pos, setPos] = createSignal({ top: 0, left: 0 });
  const aktuell = () => (props.value !== undefined ? props.value : intern());

  const basis = () => {
    const v = aktuell();
    const ref = ISO_DATUM.test(v) ? v : heuteIso();
    return { jahr: Number(ref.slice(0, 4)), monat: Number(ref.slice(5, 7)) - 1 };
  };
  const [ansicht, setAnsicht] = createSignal(basis());

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
    if (naechst) {
      setAnsicht(basis());
      positionMessen();
    }
    setOffen(naechst);
  };

  const monatTitel = createMemo(() =>
    new Intl.DateTimeFormat(aktuelleSprache(), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(ansicht().jahr, ansicht().monat, 1, 12))),
  );

  const wochentage = createMemo(() => {
    const fmt = new Intl.DateTimeFormat(aktuelleSprache(), {
      weekday: "short",
      timeZone: "UTC",
    });
    // 2026-11-23 is a Monday
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2026, 10, 23 + i, 12))).slice(0, 2),
    );
  });

  const zellen = createMemo(() =>
    kalenderGitter(ansicht().jahr, ansicht().monat, props.min, props.max),
  );
  const heute = heuteIso();

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
        placeholder={props.placeholder ?? "YYYY-MM-DD"}
        value={aktuell()}
        dir="ltr"
        class="h-9 w-full rounded-md border border-border bg-background ps-3 pe-9 font-mono text-[13px] tabular-nums outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onInput={(e) => {
          const wert = e.currentTarget.value;
          setIntern(wert);
          if (ISO_DATUM.test(wert)) {
            setAnsicht({ jahr: Number(wert.slice(0, 4)), monat: Number(wert.slice(5, 7)) - 1 });
          }
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
        aria-label="Calendar"
        aria-expanded={offen() ? "true" : "false"}
        class="absolute end-1 top-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onClick={() => oeffnen()}
      >
        <Icon icon={Calendar} size={14} />
      </button>

      <Show when={offen()}>
        <div
          data-picker-popover="date"
          style={{ top: `${pos().top}px`, left: `${pos().left}px` }}
          class="fixed z-50 w-[268px] rounded-xl border border-border bg-background p-3 shadow-lg"
        >
          <div class="mb-2.5 flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="‹"
              class="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setAnsicht((a) => monatVerschieben(a.jahr, a.monat, -1))}
            >
              <Icon icon={ChevronLeft} size={14} class="rtl:rotate-180" />
            </button>
            <span class="font-medium text-[13px]">{monatTitel()}</span>
            <button
              type="button"
              aria-label="›"
              class="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setAnsicht((a) => monatVerschieben(a.jahr, a.monat, 1))}
            >
              <Icon icon={ChevronRight} size={14} class="rtl:rotate-180" />
            </button>
          </div>

          <div class="mb-1 grid grid-cols-7 text-center">
            <For each={wochentage()}>
              {(wt) => <span class="py-1 font-medium text-[11px] text-muted-foreground">{wt}</span>}
            </For>
          </div>

          <div class="grid grid-cols-7 gap-0.5">
            <For each={zellen()}>
              {(z) => {
                const gewaehlt = () => z.tag === aktuell();
                const istHeute = () => z.tag === heute;
                return (
                  <button
                    type="button"
                    disabled={z.deaktiviert}
                    class={cn(
                      "inline-flex size-8 items-center justify-center rounded-md font-mono text-[12px] tabular-nums transition-colors",
                      !z.deaktiviert && "cursor-pointer",
                      gewaehlt()
                        ? "bg-foreground font-semibold text-background"
                        : z.imMonat
                          ? "text-foreground hover:bg-muted"
                          : "text-muted-foreground hover:bg-muted",
                      istHeute() && !gewaehlt() && "border border-foreground/40 font-medium",
                      z.deaktiviert && "cursor-not-allowed opacity-35",
                    )}
                    onClick={() => {
                      uebernehmen(z.tag);
                      setOffen(false);
                    }}
                  >
                    {z.nummer}
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

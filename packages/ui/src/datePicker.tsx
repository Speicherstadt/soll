import { Calendar, ChevronLeft, ChevronRight } from "lucide";
import { createEffect, createMemo, createSignal, For, onSettled, Show, untrack } from "solid-js";
import { cn } from "./cn.ts";
import { Icon } from "./icon.tsx";
import {
  datumAnzeigen,
  datumGueltig,
  heuteIso,
  ISO_DATUM,
  type KalenderZelle,
  kalenderGitter,
  monatVerschieben,
  popoverPosition,
  wochentagKuerzel,
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

const POPOVER_BREITE = 280;
const POPOVER_HOEHE = 312;

const aktuelleSprache = () =>
  (typeof document !== "undefined" && document.documentElement.lang) || "de";

const MONAT_INDIZES = Array.from({ length: 12 }, (_, i) => i);
const JAHRE = Array.from({ length: 121 }, (_, i) => 1920 + i);

const KalenderPopover = (props: {
  pos: { top: number; left: number };
  jahr: number;
  monat: number;
  monatsNamen: readonly string[];
  vorTitel: string;
  nachTitel: string;
  wochentage: readonly string[];
  zellen: readonly KalenderZelle[];
  aktuell: string;
  heute: string;
  onSchritt: (delta: -1 | 1) => void;
  onAnsicht: (jahr: number, monat: number) => void;
  onWaehlen: (tag: string) => void;
}) => (
  <div
    data-picker-popover="date"
    style={{ top: `${props.pos.top}px`, left: `${props.pos.left}px` }}
    class="fixed z-50 w-[280px] rounded-xl border border-border bg-background p-3 shadow-xl"
  >
    <div class="mb-3 flex items-center justify-between gap-1">
      <button
        type="button"
        aria-label={props.vorTitel}
        class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => props.onSchritt(-1)}
      >
        <Icon icon={ChevronLeft} size={14} class="rtl:rotate-180" />
      </button>
      <div class="flex items-center gap-1">
        <select
          aria-label={props.monatsNamen[props.monat]}
          value={String(props.monat)}
          onChange={(e) => props.onAnsicht(props.jahr, Number(e.currentTarget.value))}
          class="h-7 cursor-pointer rounded-md border border-border bg-background px-1.5 pe-6 font-medium text-[12px] text-foreground outline-hidden focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <For each={MONAT_INDIZES}>
            {(m) => <option value={String(m)}>{props.monatsNamen[m]}</option>}
          </For>
        </select>
        <select
          aria-label={String(props.jahr)}
          value={String(props.jahr)}
          onChange={(e) => props.onAnsicht(Number(e.currentTarget.value), props.monat)}
          class="h-7 cursor-pointer rounded-md border border-border bg-background px-1.5 pe-6 font-medium font-mono text-[12px] text-foreground tabular-nums outline-hidden focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <For each={JAHRE}>{(j) => <option value={String(j)}>{j}</option>}</For>
        </select>
      </div>
      <button
        type="button"
        aria-label={props.nachTitel}
        class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => props.onSchritt(1)}
      >
        <Icon icon={ChevronRight} size={14} class="rtl:rotate-180" />
      </button>
    </div>

    <div class="mb-1.5 grid grid-cols-7 text-center">
      <For each={props.wochentage}>
        {(wt) => <span class="py-1 font-medium text-[11px] text-muted-foreground">{wt}</span>}
      </For>
    </div>

    <div class="grid grid-cols-7 gap-0.5">
      <For each={props.zellen}>
        {(z) => {
          const gewaehlt = () => z.tag === props.aktuell;
          const istHeute = () => z.tag === props.heute;
          return (
            <button
              type="button"
              disabled={z.deaktiviert}
              class={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors",
                !z.deaktiviert && "cursor-pointer",
                gewaehlt()
                  ? "bg-foreground font-semibold text-background shadow-xs"
                  : istHeute()
                    ? "bg-muted font-semibold text-foreground hover:bg-muted/80"
                    : z.imMonat
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground hover:bg-muted",
                z.deaktiviert && "cursor-not-allowed opacity-35",
              )}
              onClick={() => props.onWaehlen(z.tag)}
            >
              {z.nummer}
            </button>
          );
        }}
      </For>
    </div>
  </div>
);

/**
 * Shadcn-style DatePicker: clean text input (YYYY-MM-DD, compatible with keyboard typing,
 * FormData and Playwright fill) paired with a dark/light calendar popover.
 */
export const DatePicker = (props: DatePickerProps) => {
  const [intern, setIntern] = createSignal(untrack(() => props.value ?? props.defaultValue ?? ""));
  const [offen, setOffen] = createSignal(false);
  const [fokussiert, setFokussiert] = createSignal(false);
  const [pos, setPos] = createSignal({ top: 0, left: 0 });
  const aktuell = () => (props.value !== undefined ? props.value : intern());

  const basis = () => {
    const v = aktuell();
    const ref = ISO_DATUM.test(v) ? v : heuteIso();
    return { jahr: Number(ref.slice(0, 4)), monat: Number(ref.slice(5, 7)) - 1 };
  };
  const [ansicht, setAnsicht] = createSignal(untrack(() => basis()));

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

  createEffect(
    () => [aktuell(), props.min, props.max] as const,
    ([wert, min, max]) => {
      inputRef?.setCustomValidity(datumGueltig(wert, min, max));
    },
  );

  const uebernehmen = (neu: string) => {
    setIntern(neu);
    if (inputRef) {
      inputRef.value = neu;
      inputRef.setCustomValidity(datumGueltig(neu, props.min, props.max));
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

  const monatName = (jahr: number, monat: number) =>
    new Intl.DateTimeFormat(aktuelleSprache(), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(jahr, monat, 1, 12)));

  const monatTitel = createMemo(() => monatName(ansicht().jahr, ansicht().monat));
  const vorTitel = createMemo(() => {
    const m = monatVerschieben(ansicht().jahr, ansicht().monat, -1);
    return monatName(m.jahr, m.monat);
  });
  const nachTitel = createMemo(() => {
    const m = monatVerschieben(ansicht().jahr, ansicht().monat, 1);
    return monatName(m.jahr, m.monat);
  });
  const monatsNamen = createMemo(() => {
    const fmt = new Intl.DateTimeFormat(aktuelleSprache(), { month: "short", timeZone: "UTC" });
    return MONAT_INDIZES.map((m) =>
      fmt.format(new Date(Date.UTC(2026, m, 1, 12))).replace(/\.$/, ""),
    );
  });
  const wochentage = createMemo(() => wochentagKuerzel(aktuelleSprache()));
  const zellen = createMemo(() =>
    kalenderGitter(ansicht().jahr, ansicht().monat, props.min, props.max),
  );
  const heute = heuteIso();

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
        placeholder={props.placeholder ?? "YYYY-MM-DD"}
        value={aktuell()}
        dir="ltr"
        class="h-9 w-full rounded-md border border-border bg-background ps-3 pe-9 font-mono text-[13px] tabular-nums transition-colors hover:border-foreground/30 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onInput={(e) => {
          const wert = e.currentTarget.value;
          setIntern(wert);
          e.currentTarget.setCustomValidity(datumGueltig(wert, props.min, props.max));
          if (ISO_DATUM.test(wert)) {
            setAnsicht({ jahr: Number(wert.slice(0, 4)), monat: Number(wert.slice(5, 7)) - 1 });
          }
          props.onValue?.(wert);
        }}
        onFocus={() => setFokussiert(true)}
        onBlur={() => setFokussiert(false)}
        onClick={() => oeffnen(true)}
      />
      <Show when={!fokussiert() && ISO_DATUM.test(aktuell())}>
        <span
          aria-hidden="true"
          dir="ltr"
          class="pointer-events-none absolute inset-y-[3px] start-[3px] end-9 flex items-center rounded-sm bg-background ps-2.5 font-mono text-[13px] text-foreground tabular-nums"
        >
          {datumAnzeigen(aktuell(), aktuelleSprache())}
        </span>
      </Show>
      <button
        type="button"
        disabled={props.disabled}
        aria-label={monatTitel()}
        aria-expanded={offen() ? "true" : "false"}
        class="absolute end-1 top-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onClick={() => oeffnen()}
      >
        <Icon icon={Calendar} size={14} />
      </button>

      <Show when={offen()}>
        <KalenderPopover
          pos={pos()}
          jahr={ansicht().jahr}
          monat={ansicht().monat}
          monatsNamen={monatsNamen()}
          vorTitel={vorTitel()}
          nachTitel={nachTitel()}
          wochentage={wochentage()}
          zellen={zellen()}
          aktuell={aktuell()}
          heute={heute}
          onSchritt={(delta) => setAnsicht((a) => monatVerschieben(a.jahr, a.monat, delta))}
          onAnsicht={(jahr, monat) => setAnsicht({ jahr, monat })}
          onWaehlen={(tag) => {
            uebernehmen(tag);
            setOffen(false);
            setFokussiert(false);
          }}
        />
      </Show>
    </div>
  );
};

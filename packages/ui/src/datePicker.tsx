import { Calendar, ChevronLeft, ChevronRight } from "lucide";
import {
  createEffect,
  createMemo,
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
  datumAnzeigen,
  datumGueltig,
  datumLang,
  einheitName,
  heuteIso,
  ISO_DATUM,
  type KalenderZelle,
  kalenderGitter,
  kalenderNachbar,
  monatVerschieben,
  wochentagKuerzel,
} from "./pickerDaten.ts";
import { verankert } from "./popover.tsx";

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

const aktuelleSprache = () =>
  (typeof document !== "undefined" && document.documentElement.lang) || "de";

const MONAT_INDIZES = Array.from({ length: 12 }, (_, i) => i);
const JAHRE = Array.from({ length: 121 }, (_, i) => 1920 + i);

const NAV_KNOPF =
  "inline-flex size-10 md:size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-control-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground";

const monatName = (sprache: string, jahr: number, monat: number) =>
  new Intl.DateTimeFormat(sprache, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(jahr, monat, 1, 12)));

const KalenderPopover = (props: {
  id: string;
  anker: string;
  sprache: string;
  jahr: number;
  monat: number;
  monatsNamen: readonly string[];
  vorTitel: string;
  nachTitel: string;
  wochentage: readonly string[];
  zellen: readonly KalenderZelle[];
  aktuell: string;
  heute: string;
  ref: (el: HTMLDivElement) => void;
  onSchritt: (delta: -1 | 1) => void;
  onAnsicht: (jahr: number, monat: number) => void;
  onWaehlen: (tag: string) => void;
}) => {
  let gitterRef: HTMLDivElement | undefined;
  const beiTaste = (event: KeyboardEvent, index: number) => {
    const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const ziel = kalenderNachbar(
      index,
      event.key,
      rtl,
      props.zellen.map((z) => z.deaktiviert),
    );
    if (ziel === undefined) return;
    event.preventDefault();
    gitterRef?.querySelectorAll<HTMLButtonElement>("button")[ziel]?.focus();
  };
  return (
    <div
      id={props.id}
      ref={props.ref}
      popover="manual"
      data-picker-popover="date"
      style={verankert(props.anker)}
      class="w-[296px] overscroll-contain rounded-xl border border-border bg-background p-3 text-foreground shadow-xl md:w-[280px]"
    >
      <div class="mb-3 flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label={props.vorTitel}
          class={NAV_KNOPF}
          onClick={() => props.onSchritt(-1)}
        >
          <Icon icon={ChevronLeft} size={14} class="rtl:rotate-180" />
        </button>
        <div class="flex items-center gap-1">
          <select
            aria-label={einheitName("month", props.sprache)}
            value={String(props.monat)}
            onChange={(e) => props.onAnsicht(props.jahr, Number(e.currentTarget.value))}
            class="h-10 cursor-pointer rounded-md border border-control-border bg-background px-1.5 pe-6 font-medium text-[12px] text-foreground outline-hidden focus-visible:outline-2 focus-visible:outline-foreground md:h-7"
          >
            <For each={MONAT_INDIZES}>
              {(m) => <option value={String(m)}>{props.monatsNamen[m]}</option>}
            </For>
          </select>
          <select
            aria-label={einheitName("year", props.sprache)}
            value={String(props.jahr)}
            onChange={(e) => props.onAnsicht(Number(e.currentTarget.value), props.monat)}
            class="h-10 cursor-pointer rounded-md border border-control-border bg-background px-1.5 pe-6 font-medium font-mono text-[12px] text-foreground tabular-nums outline-hidden focus-visible:outline-2 focus-visible:outline-foreground md:h-7"
          >
            <For each={JAHRE}>{(j) => <option value={String(j)}>{j}</option>}</For>
          </select>
        </div>
        <button
          type="button"
          aria-label={props.nachTitel}
          class={NAV_KNOPF}
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

      <div ref={gitterRef} class="grid grid-cols-7 gap-0.5">
        <For each={props.zellen}>
          {(z, index) => {
            const gewaehlt = () => z.tag === props.aktuell;
            const istHeute = () => z.tag === props.heute;
            return (
              <button
                type="button"
                disabled={z.deaktiviert}
                aria-label={datumLang(z.tag, props.sprache)}
                aria-pressed={gewaehlt() ? "true" : "false"}
                aria-current={istHeute() ? "date" : undefined}
                class={cn(
                  "inline-flex size-10 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-foreground md:size-8",
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
                onKeyDown={(e) => beiTaste(e, index())}
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
};

/** Keeps outside-click, Esc, and form-reset listeners for a popover-based picker */
const pickerEreignisse = (
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

const kalenderLabels = (sprache: () => string, ansicht: () => { jahr: number; monat: number }) => ({
  vorTitel: createMemo(() => {
    const m = monatVerschieben(ansicht().jahr, ansicht().monat, -1);
    return monatName(sprache(), m.jahr, m.monat);
  }),
  nachTitel: createMemo(() => {
    const m = monatVerschieben(ansicht().jahr, ansicht().monat, 1);
    return monatName(sprache(), m.jahr, m.monat);
  }),
  monatsNamen: createMemo(() => {
    const fmt = new Intl.DateTimeFormat(sprache(), { month: "short", timeZone: "UTC" });
    return MONAT_INDIZES.map((m) =>
      fmt.format(new Date(Date.UTC(2026, m, 1, 12))).replace(/\.$/, ""),
    );
  }),
  wochentage: createMemo(() => wochentagKuerzel(sprache())),
});

/**
 * Shadcn-style DatePicker: clean text input (YYYY-MM-DD, compatible with keyboard typing,
 * FormData and Playwright fill) paired with a top-layer Popover API calendar.
 */
export const DatePicker = (props: DatePickerProps) => {
  const popoverId = createUniqueId();
  const anker = `--date-${popoverId}`;
  const [intern, setIntern] = createSignal(untrack(() => props.value ?? props.defaultValue ?? ""));
  const [offen, setOffen] = createSignal(false);
  const [fokussiert, setFokussiert] = createSignal(false);
  const aktuell = () => (props.value !== undefined ? props.value : intern());
  const basis = () => {
    const ref = ISO_DATUM.test(aktuell()) ? aktuell() : heuteIso();
    return { jahr: Number(ref.slice(0, 4)), monat: Number(ref.slice(5, 7)) - 1 };
  };
  const [ansicht, setAnsicht] = createSignal(untrack(() => basis()));
  let huelleRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;
  let popoverRef: HTMLDivElement | undefined;

  const setzeOffen = (auf: boolean) => {
    if (auf && props.disabled) return;
    if (auf) setAnsicht(basis());
    setOffen(auf);
    if (auf && !popoverRef?.matches(":popover-open")) popoverRef?.showPopover();
    if (!auf && popoverRef?.matches(":popover-open")) popoverRef.hidePopover();
  };

  pickerEreignisse(
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

  const sprache = () => aktuelleSprache();
  const labels = kalenderLabels(sprache, ansicht);
  const zellen = createMemo(() =>
    kalenderGitter(ansicht().jahr, ansicht().monat, props.min, props.max),
  );
  const heute = heuteIso();

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
        placeholder={props.placeholder ?? "YYYY-MM-DD"}
        value={aktuell()}
        dir="ltr"
        class="h-9 w-full rounded-md border border-control-border bg-background ps-3 pe-9 font-mono text-[13px] tabular-nums transition-colors hover:border-foreground/40 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onInput={(e) => {
          const wert = e.currentTarget.value;
          setIntern(wert);
          e.currentTarget.setCustomValidity(datumGueltig(wert, props.min, props.max));
          if (ISO_DATUM.test(wert))
            setAnsicht({ jahr: Number(wert.slice(0, 4)), monat: Number(wert.slice(5, 7)) - 1 });
          props.onValue?.(wert);
        }}
        onFocus={() => setFokussiert(true)}
        onBlur={() => setFokussiert(false)}
        onClick={() => setzeOffen(true)}
      />
      <Show when={!fokussiert() && ISO_DATUM.test(aktuell())}>
        <span
          aria-hidden="true"
          dir="ltr"
          class="pointer-events-none absolute inset-y-[3px] start-[3px] end-9 flex items-center rounded-sm bg-background ps-2.5 font-mono text-[13px] text-foreground tabular-nums"
        >
          {datumAnzeigen(aktuell(), sprache())}
        </span>
      </Show>
      <button
        type="button"
        disabled={props.disabled}
        aria-label={einheitName("day", sprache())}
        aria-expanded={offen() ? "true" : "false"}
        aria-controls={popoverId}
        class="absolute end-1 top-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
        onClick={() => setzeOffen(!offen())}
      >
        <Icon icon={Calendar} size={14} />
      </button>
      <KalenderPopover
        id={popoverId}
        anker={anker}
        ref={(el) => {
          popoverRef = el;
        }}
        sprache={sprache()}
        jahr={ansicht().jahr}
        monat={ansicht().monat}
        monatsNamen={labels.monatsNamen()}
        vorTitel={labels.vorTitel()}
        nachTitel={labels.nachTitel()}
        wochentage={labels.wochentage()}
        zellen={zellen()}
        aktuell={aktuell()}
        heute={heute}
        onSchritt={(delta) => setAnsicht((a) => monatVerschieben(a.jahr, a.monat, delta))}
        onAnsicht={(jahr, monat) => setAnsicht({ jahr, monat })}
        onWaehlen={(tag) => {
          uebernehmen(tag);
          setzeOffen(false);
          setFokussiert(false);
        }}
      />
    </div>
  );
};

import { buchungsMinuten } from "@soll/arbeitszeit";
import { Button, Icon } from "@soll/ui";
import { Play, Square } from "lucide";
import { For, Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { uhrzeitText } from "../zeiten/text.ts";
import { Auswahl, wahlAus } from "./auswahl.tsx";
import type { StoppuhrQuelle } from "./quelle.ts";
import { buchbar, wahlText } from "./text.ts";
import type { Buchung, Wahl } from "./typen.ts";

/**
 * Fixed-height stopwatch hero card: identical layout in idle and running states so starting or
 * stopping never shifts the page below (0px CLS).
 */
export const LaufendKarte = (props: {
  quelle: StoppuhrQuelle;
  laufend: Buchung | null;
  arbeitet: boolean;
  onStoppen: () => void;
}) => {
  const dauer = () =>
    props.laufend
      ? dauerText(buchungsMinuten(props.laufend.beginn, null, props.quelle.jetzt()))
      : "0:00";
  const beschreibung = () =>
    props.laufend
      ? wahlText(props.quelle.projekte(), props.quelle.taetigkeiten(), props.laufend)
      : "\u00A0";

  return (
    <div class="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="inline-flex w-fit items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[13px]">
          <span
            aria-hidden="true"
            class={`size-2 rounded-full ${props.laufend ? "bg-success" : "bg-muted-foreground/50"}`}
          />
          <Show
            when={props.laufend}
            fallback={<span class="text-muted-foreground">{m.stoppuhr_steht()}</span>}
          >
            {(laufend) => (
              <span data-testid="stoppuhr-laufend">
                {m.stoppuhr_laeuft({ uhrzeit: uhrzeitText(laufend().beginn) })}
              </span>
            )}
          </Show>
        </div>
        <p
          class={`font-mono font-semibold text-[36px] tabular-nums leading-none tracking-tight ${
            props.laufend ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {dauer()}
        </p>
        <p class="truncate font-medium text-[13px] text-muted-foreground leading-5">
          {beschreibung()}
        </p>
      </div>
      <Button
        variant="outline"
        class="h-11 w-full shrink-0 sm:w-auto sm:px-5"
        disabled={!props.laufend || props.arbeitet}
        onClick={() => props.onStoppen()}
      >
        <Icon icon={Square} size={16} />
        {m.stoppuhr_stoppen()}
      </Button>
    </div>
  );
};

const gleich = (a: Wahl, b: Wahl | null) =>
  b !== null && a.projektId === b.projektId && a.taetigkeitId === b.taetigkeitId;

/**
 * The switch in one tap: recent orders/activities as compact chips, and an inline single-row form
 * to start or switch cleanly without wasted vertical space.
 */
export const Wechsel = (props: {
  quelle: StoppuhrQuelle;
  zuletzt: Wahl[];
  laufend: Buchung | null;
  arbeitet: boolean;
  onStarten: (wahl: Wahl) => void;
}) => {
  const zuletzt = () =>
    props.zuletzt.filter((wahl) =>
      buchbar(props.quelle.projekte(), props.quelle.taetigkeiten(), wahl),
    );
  const name = (wahl: Wahl) => wahlText(props.quelle.projekte(), props.quelle.taetigkeiten(), wahl);
  return (
    <div class="flex flex-col gap-3">
      <form
        aria-label={m.stoppuhr_neu()}
        class="grid grid-cols-1 gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          props.onStarten(wahlAus(new FormData(event.currentTarget)));
        }}
      >
        <Auswahl projekte={props.quelle.projekte()} taetigkeiten={props.quelle.taetigkeiten()} />
        <Button type="submit" class="h-9 w-full sm:w-auto sm:px-4" disabled={props.arbeitet}>
          <Icon icon={Play} size={15} />
          {props.laufend ? m.stoppuhr_wechseln() : m.stoppuhr_starten()}
        </Button>
      </form>
      <Show when={zuletzt().length > 0}>
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium text-[12px] text-muted-foreground">{m.stoppuhr_zuletzt()}</span>
          <For each={zuletzt()}>
            {(wahl) => (
              <Button
                variant="outline"
                class="min-h-11 sm:min-h-8 sm:px-3 sm:text-[13px]"
                aria-pressed={gleich(wahl, props.laufend) ? "true" : "false"}
                aria-label={m.stoppuhr_wechseln_zu({ name: name(wahl) })}
                disabled={props.arbeitet}
                onClick={() => props.onStarten(wahl)}
              >
                {name(wahl)}
              </Button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

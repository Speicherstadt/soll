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

/** The running booking: what it is on, since when, its time in large digits, and Stoppen */
export const LaufendKarte = (props: {
  quelle: StoppuhrQuelle;
  laufend: Buchung | null;
  arbeitet: boolean;
  onStoppen: () => void;
}) => (
  <div class="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
    <Show
      when={props.laufend}
      fallback={
        <div class="flex items-center gap-2 text-[14px] text-muted-foreground">
          <span aria-hidden="true" class="size-2 rounded-full bg-muted-foreground/50" />
          <span>{m.stoppuhr_steht()}</span>
        </div>
      }
    >
      {(laufend) => (
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-2">
            <div class="inline-flex w-fit items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[13px]">
              <span aria-hidden="true" class="size-2 rounded-full bg-success" />
              <span data-testid="stoppuhr-laufend">
                {m.stoppuhr_laeuft({ uhrzeit: uhrzeitText(laufend().beginn) })}
              </span>
            </div>
            <p class="font-medium text-[15px]">
              {wahlText(props.quelle.projekte(), props.quelle.taetigkeiten(), laufend())}
            </p>
            <p class="font-mono font-semibold text-[36px] tabular-nums leading-none tracking-tight">
              {dauerText(buchungsMinuten(laufend().beginn, null, props.quelle.jetzt()))}
            </p>
          </div>
          <Button
            variant="outline"
            class="h-12 w-full rounded-xl text-[15px] sm:h-11 sm:w-auto sm:rounded-lg sm:px-5"
            disabled={props.arbeitet}
            onClick={() => props.onStoppen()}
          >
            <Icon icon={Square} size={18} />
            {m.stoppuhr_stoppen()}
          </Button>
        </div>
      )}
    </Show>
  </div>
);

const gleich = (a: Wahl, b: Wahl | null) =>
  b !== null && a.projektId === b.projektId && a.taetigkeitId === b.taetigkeitId;

/**
 * The switch in one tap: the orders and activities booked last as buttons, the running one pressed,
 * and a form to start anything else; starting while one runs ends that one
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
      <Show when={zuletzt().length > 0}>
        <div class="flex flex-col gap-2">
          <h3 class="font-semibold text-[13px] text-muted-foreground">{m.stoppuhr_zuletzt()}</h3>
          <div class="flex flex-wrap gap-2">
            <For each={zuletzt()}>
              {(wahl) => (
                <Button
                  variant="outline"
                  class="min-h-11"
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
        </div>
      </Show>
      <form
        aria-label={m.stoppuhr_neu()}
        class="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
        onSubmit={(event) => {
          event.preventDefault();
          props.onStarten(wahlAus(new FormData(event.currentTarget)));
        }}
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Auswahl projekte={props.quelle.projekte()} taetigkeiten={props.quelle.taetigkeiten()} />
        </div>
        <Button
          type="submit"
          class="h-11 w-full sm:w-auto sm:self-end sm:px-5"
          disabled={props.arbeitet}
        >
          <Icon icon={Play} size={18} />
          {props.laufend ? m.stoppuhr_wechseln() : m.stoppuhr_starten()}
        </Button>
      </form>
    </div>
  );
};

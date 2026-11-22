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
  <div class="flex flex-col gap-3 rounded-xl border border-border p-4">
    <Show when={props.laufend} fallback={<p class="text-muted-foreground">{m.stoppuhr_steht()}</p>}>
      {(laufend) => (
        <>
          <div class="flex items-center gap-2 text-[15px]">
            <span aria-hidden="true" class="size-2.5 rounded-full bg-success" />
            <span data-testid="stoppuhr-laufend">
              {m.stoppuhr_laeuft({ uhrzeit: uhrzeitText(laufend().beginn) })}
            </span>
          </div>
          <p class="font-medium">
            {wahlText(props.quelle.projekte(), props.quelle.taetigkeiten(), laufend())}
          </p>
          <p class="font-mono font-semibold text-[40px] tabular-nums leading-none tracking-tight">
            {dauerText(buchungsMinuten(laufend().beginn, null, props.quelle.jetzt()))}
          </p>
          <Button
            variant="outline"
            class="h-[52px] rounded-xl text-[16px]"
            disabled={props.arbeitet}
            onClick={() => props.onStoppen()}
          >
            <Icon icon={Square} size={20} />
            {m.stoppuhr_stoppen()}
          </Button>
        </>
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
        class="flex flex-col gap-3 rounded-lg border border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          props.onStarten(wahlAus(new FormData(event.currentTarget)));
        }}
      >
        <Auswahl projekte={props.quelle.projekte()} taetigkeiten={props.quelle.taetigkeiten()} />
        <Button type="submit" class="min-h-11" disabled={props.arbeitet}>
          <Icon icon={Play} size={20} />
          {props.laufend ? m.stoppuhr_wechseln() : m.stoppuhr_starten()}
        </Button>
      </form>
    </div>
  );
};

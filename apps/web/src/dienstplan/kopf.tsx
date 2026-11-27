import type { Tag } from "@soll/arbeitszeit";
import { Button, cn, Icon } from "@soll/ui";
import { CalendarPlus, ChevronLeft, ChevronRight, Maximize2, Minimize2, Printer } from "lucide";
import { For, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { monatText } from "../monat/text.ts";
import { m } from "../paraglide/messages.js";
import type { PlanAnsicht } from "./farben.ts";
import { Feld } from "./felder.tsx";
import { tagLang, zeitraumText } from "./text.ts";
import type { Standort, Woche } from "./typen.ts";

/** Whether the week shows a draft, which publishing makes visible to the people (S-503) */
export const hatEntwurf = (woche: Woche | null): boolean =>
  woche?.schichten.some((s) => s.veroeffentlichtAm === null) ?? false;

const ANSICHTEN: readonly { id: PlanAnsicht; label: () => string }[] = [
  { id: "tag", label: () => m.plan_ansicht_tag() },
  { id: "woche", label: () => m.plan_ansicht_woche() },
  { id: "monat", label: () => m.plan_ansicht_monat() },
];

/**
 * The head of the plan: Day/Week/Month switcher, adaptive date subtitle, navigation arrows,
 * site selector, Print & Fullscreen (TV/monitor) buttons, plus planner actions.
 */
export const PlanKopf = (props: {
  woche: Woche | null;
  tag: Tag;
  ansicht: PlanAnsicht;
  vollbild: boolean;
  standorte: readonly Standort[];
  standortId: string;
  planer: boolean;
  /** the owner keeps the data of a person the rules need (S-502) */
  inhaber: boolean;
  onAnsicht: (ansicht: PlanAnsicht) => void;
  onSchritt: (schritt: -1 | 1) => void;
  onStandort: (standortId: string) => void;
  onDrucken: () => void;
  onVollbild: () => void;
  onVorlagen: () => void;
  onBedarf: () => void;
  onAngaben: () => void;
  onKalender: () => void;
  onVeroeffentlichen: () => void;
  /** while a publish is on its way */
  veroeffentlicht: boolean;
}) => {
  const untertitel = () => {
    if (props.ansicht === "tag") return tagLang(props.tag);
    if (props.ansicht === "monat") return monatText(props.tag.slice(0, 7));
    if (!props.woche) return "";
    return m.plan_untertitel({
      kw: props.woche.kw.nummer,
      zeitraum: zeitraumText(props.woche.tage[0] ?? "", props.woche.tage[6] ?? ""),
    });
  };
  return (
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <fieldset
          aria-label={m.plan_ansicht()}
          data-print-hidden=""
          class="inline-flex rounded-lg border border-border bg-muted/50 p-0.5"
        >
          <For each={ANSICHTEN}>
            {(item) => {
              const aktiv = () => props.ansicht === item.id;
              return (
                <button
                  type="button"
                  aria-pressed={aktiv() ? "true" : "false"}
                  class={cn(
                    "cursor-pointer rounded-md px-3 py-1 text-[13px] font-medium transition-colors",
                    aktiv()
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => props.onAnsicht(item.id)}
                >
                  {item.label()}
                </button>
              );
            }}
          </For>
        </fieldset>
        <Show when={untertitel()}>
          <p class="text-muted-foreground">
            {untertitel()}
            <Show when={props.ansicht === "woche" && hatEntwurf(props.woche)}>
              {" · "}
              {m.plan_entwurf()}
            </Show>
          </p>
        </Show>
      </div>
      <div class="flex flex-wrap items-end gap-2" data-print-hidden="">
        <Show when={props.standorte.length > 1}>
          <Feld
            label={m.plan_standort()}
            kind={(id) => (
              <select
                id={id}
                class={feld}
                value={props.standortId}
                onChange={(e) => props.onStandort(e.currentTarget.value)}
              >
                <For each={props.standorte}>
                  {(s) => <option value={s.standortId}>{s.name}</option>}
                </For>
              </select>
            )}
          />
        </Show>
        <Button
          variant="icon"
          aria-label={m.plan_vorige_woche()}
          class="border border-border"
          onClick={() => props.onSchritt(-1)}
        >
          <Icon icon={ChevronLeft} class="rtl:rotate-180" />
        </Button>
        <Button
          variant="icon"
          aria-label={m.plan_naechste_woche()}
          class="border border-border"
          onClick={() => props.onSchritt(1)}
        >
          <Icon icon={ChevronRight} class="rtl:rotate-180" />
        </Button>
        <Button variant="outline" onClick={() => props.onDrucken()}>
          <Icon icon={Printer} />
          <span class="max-sm:sr-only">{m.plan_drucken()}</span>
        </Button>
        <Button variant="outline" onClick={() => props.onVollbild()}>
          <Icon icon={props.vollbild ? Minimize2 : Maximize2} />
          <span class="max-sm:sr-only">
            {props.vollbild ? m.plan_vollbild_beenden() : m.plan_vollbild()}
          </span>
        </Button>
        <Show when={!props.vollbild}>
          <Button variant="outline" onClick={() => props.onKalender()}>
            <Icon icon={CalendarPlus} />
            {m.plan_kalender()}
          </Button>
          <Show when={props.planer}>
            <Button variant="outline" onClick={() => props.onVorlagen()}>
              {m.plan_vorlagen()}
            </Button>
            <Button variant="outline" onClick={() => props.onBedarf()}>
              {m.plan_bedarf()}
            </Button>
          </Show>
          <Show when={props.inhaber}>
            <Button variant="outline" onClick={() => props.onAngaben()}>
              {m.plan_angaben()}
            </Button>
          </Show>
          <Show when={props.planer}>
            <Button
              disabled={!hatEntwurf(props.woche) || props.veroeffentlicht}
              onClick={() => props.onVeroeffentlichen()}
            >
              {m.plan_veroeffentlichen()}
            </Button>
          </Show>
        </Show>
      </div>
    </header>
  );
};

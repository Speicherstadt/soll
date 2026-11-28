import type { Tag } from "@soll/arbeitszeit";
import { Button, cn, Icon, Menu, type MenuEintrag } from "@soll/ui";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Maximize2,
  Minimize2,
  Printer,
} from "lucide";
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

/** Accessible prev/next label matching the active view (Day / Week / Month) (#120) */
export const schrittLabel = (ansicht: PlanAnsicht, schritt: -1 | 1): string => {
  if (ansicht === "tag") return schritt < 0 ? m.plan_voriger_tag() : m.plan_naechster_tag();
  if (ansicht === "monat") return schritt < 0 ? m.plan_voriger_monat() : m.plan_naechster_monat();
  return schritt < 0 ? m.plan_vorige_woche() : m.plan_naechste_woche();
};

const ANSICHTEN: readonly { id: PlanAnsicht; label: () => string }[] = [
  { id: "tag", label: () => m.plan_ansicht_tag() },
  { id: "woche", label: () => m.plan_ansicht_woche() },
  { id: "monat", label: () => m.plan_ansicht_monat() },
];

type PlanKopfProps = {
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
};

const AnsichtsWechsler = (props: {
  ansicht: PlanAnsicht;
  onAnsicht: (ansicht: PlanAnsicht) => void;
}) => (
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
              "min-h-11 cursor-pointer rounded-md px-3 py-1 font-medium text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-foreground md:min-h-7",
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
);

const mobileEintraege = (props: PlanKopfProps): MenuEintrag[] => [
  ...(props.planer
    ? [
        { label: m.plan_vorlagen(), onWaehlen: () => props.onVorlagen() },
        { label: m.plan_bedarf(), onWaehlen: () => props.onBedarf() },
      ]
    : []),
  ...(props.inhaber ? [{ label: m.plan_angaben(), onWaehlen: () => props.onAngaben() }] : []),
  { label: m.plan_drucken(), onWaehlen: () => props.onDrucken() },
  {
    label: props.vollbild ? m.plan_vollbild_beenden() : m.plan_vollbild(),
    onWaehlen: () => props.onVollbild(),
  },
];

/**
 * The head of the plan: Day/Week/Month switcher, adaptive date subtitle, navigation arrows,
 * site selector, Print & Fullscreen (TV/monitor) buttons, plus planner actions. Secondary actions
 * collapse into a menu on narrow phones so the toolbar stays calm.
 */
export const PlanKopf = (props: PlanKopfProps) => {
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
        <AnsichtsWechsler ansicht={props.ansicht} onAnsicht={props.onAnsicht} />
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
          aria-label={schrittLabel(props.ansicht, -1)}
          class="min-h-11 min-w-11 border border-border md:min-h-9 md:min-w-9"
          onClick={() => props.onSchritt(-1)}
        >
          <Icon icon={ChevronLeft} class="rtl:rotate-180" />
        </Button>
        <Button
          variant="icon"
          aria-label={schrittLabel(props.ansicht, 1)}
          class="min-h-11 min-w-11 border border-border md:min-h-9 md:min-w-9"
          onClick={() => props.onSchritt(1)}
        >
          <Icon icon={ChevronRight} class="rtl:rotate-180" />
        </Button>
        <Button variant="outline" class="max-sm:hidden" onClick={() => props.onDrucken()}>
          <Icon icon={Printer} />
          {m.plan_drucken()}
        </Button>
        <Button
          variant="outline"
          class={props.vollbild ? "min-h-11 md:min-h-9" : "max-sm:hidden"}
          onClick={() => props.onVollbild()}
        >
          <Icon icon={props.vollbild ? Minimize2 : Maximize2} />
          {props.vollbild ? m.plan_vollbild_beenden() : m.plan_vollbild()}
        </Button>
        <Show when={!props.vollbild}>
          <Button variant="outline" class="min-h-11 md:min-h-9" onClick={() => props.onKalender()}>
            <Icon icon={CalendarPlus} />
            {m.plan_kalender()}
          </Button>
          <Show when={props.planer}>
            <Button variant="outline" class="max-sm:hidden" onClick={() => props.onVorlagen()}>
              {m.plan_vorlagen()}
            </Button>
            <Button variant="outline" class="max-sm:hidden" onClick={() => props.onBedarf()}>
              {m.plan_bedarf()}
            </Button>
          </Show>
          <Show when={props.inhaber}>
            <Button variant="outline" class="max-sm:hidden" onClick={() => props.onAngaben()}>
              {m.plan_angaben()}
            </Button>
          </Show>
          <div class="sm:hidden">
            <Menu
              variant="icon"
              aria-label={m.plan_aktionen()}
              ausloeser={<Icon icon={Ellipsis} />}
              eintraege={mobileEintraege(props)}
            />
          </div>
          <Show when={props.planer && hatEntwurf(props.woche)}>
            <Button
              class="min-h-11 md:min-h-9"
              disabled={props.veroeffentlicht}
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

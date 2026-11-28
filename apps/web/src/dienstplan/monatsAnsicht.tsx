import { type Tag, tagInBerlin } from "@soll/arbeitszeit";
import { cn } from "@soll/ui";
import { createMemo, createSignal, For, Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { uhrzeitText } from "../zeiten/text.ts";
import { blockText } from "./block.tsx";
import { monatKalenderTage, schichtFarbe } from "./farben.ts";
import { Feld } from "./felder.tsx";
import { tagDerZahl, tagLang, wochentagKurz } from "./text.ts";
import type { Planperson, Schicht, Vorlage, Woche } from "./typen.ts";

const WOCHEN_SLOTS = [0, 1, 2, 3, 4, 5] as const;

const MonatsZelle = (props: {
  tag: Tag;
  imMonat: boolean;
  wochenende: boolean;
  istHeute: boolean;
  schichten: readonly Schicht[];
  vorlagen: readonly Vorlage[];
  personenMap: ReadonlyMap<string, string>;
  filterPerson: string;
  planer: boolean;
  onTagOeffnen: (tag: Tag) => void;
  onOeffnen: (schicht: Schicht) => void;
}) => (
  <div
    class={cn(
      "flex min-h-[112px] flex-col gap-1 border-border border-e border-b p-1.5 last:border-e-0",
      props.wochenende && "bg-muted/35",
      !props.imMonat && "bg-muted/25 text-muted-foreground",
    )}
  >
    <div class="flex items-center justify-between">
      <button
        type="button"
        aria-label={tagLang(props.tag)}
        aria-current={props.istHeute ? "date" : undefined}
        class={cn(
          "inline-flex size-6 cursor-pointer items-center justify-center rounded-full font-mono text-[12px] tabular-nums transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-foreground",
          props.istHeute && "bg-foreground font-semibold text-background hover:bg-foreground",
        )}
        onClick={() => props.onTagOeffnen(props.tag)}
      >
        {tagDerZahl(props.tag)}
      </button>
      <Show when={props.schichten.length > 0}>
        <span class="font-mono text-[11px] text-muted-foreground tabular-nums">
          {props.schichten.length}
        </span>
      </Show>
    </div>

    <div class="flex flex-col gap-1.5">
      <For each={props.schichten.slice(0, 4)} keyed={(s) => s.schichtId}>
        {(schicht) => {
          const farbe = () => schichtFarbe(schicht(), props.vorlagen);
          const beschriftung = () => {
            const start = uhrzeitText(schicht().beginn);
            if (props.filterPerson) return `${start} ${blockText(schicht(), props.vorlagen)}`;
            const name =
              schicht().nutzerId === null
                ? m.plan_offen()
                : (props.personenMap.get(schicht().nutzerId ?? "") ?? "");
            return `${start} ${name}`;
          };
          return (
            <Show
              when={props.planer}
              fallback={
                <div
                  class={cn(
                    "min-h-6 truncate rounded-xs px-1.5 py-1 text-[11px] leading-tight",
                    farbe().pill,
                  )}
                  title={beschriftung()}
                >
                  {beschriftung()}
                </div>
              }
            >
              <button
                type="button"
                class={cn(
                  "min-h-6 w-full cursor-pointer truncate rounded-xs px-1.5 py-1 text-start text-[11px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-foreground",
                  farbe().pill,
                )}
                title={beschriftung()}
                onClick={() => props.onOeffnen(schicht())}
              >
                {beschriftung()}
              </button>
            </Show>
          );
        }}
      </For>
      <Show when={props.schichten.length > 4}>
        <button
          type="button"
          aria-label={m.plan_weitere_schichten({
            anzahl: props.schichten.length - 4,
            tag: tagLang(props.tag),
          })}
          class="min-h-6 cursor-pointer rounded-xs px-1.5 py-0.5 text-start text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
          onClick={() => props.onTagOeffnen(props.tag)}
        >
          +{props.schichten.length - 4}
        </button>
      </Show>
    </div>
  </div>
);

/**
 * Classic Mon-Sun month calendar view for Dienstplan: fetches the weeks covering the displayed
 * month, renders color-coded shift pills per day, and offers a person filter so any employee or
 * planner can inspect either the whole team or one person's month at a glance.
 */
export const MonatsAnsicht = (props: {
  standortId: string;
  tag: Tag;
  personen: readonly Planperson[];
  vorlagen: readonly Vorlage[];
  planer: boolean;
  onTagOeffnen: (tag: Tag) => void;
  onOeffnen: (schicht: Schicht) => void;
}) => {
  const [filterPerson, setFilterPerson] = createSignal("");
  const kalender = createMemo(() => monatKalenderTage(props.tag));
  const wochen = WOCHEN_SLOTS.map((slot) =>
    abfrage<Woche>(() => {
      const montag = kalender().montage[slot];
      return montag ? ressourcen.woche({ standortId: props.standortId, tag: montag }) : null;
    }),
  );
  const personenMap = createMemo(() => new Map(props.personen.map((p) => [p.nutzerId, p.name])));
  const schichtenNachTag = createMemo(() => {
    const gesammelt = new Map<string, Schicht>();
    for (const w of wochen) {
      const geladen = daten(w.data);
      if (!geladen) continue;
      for (const s of geladen.schichten) gesammelt.set(s.schichtId, s);
    }
    const nachTag = new Map<string, Schicht[]>();
    const filter = filterPerson();
    for (const s of gesammelt.values()) {
      if (filter && s.nutzerId !== filter) continue;
      const liste = nachTag.get(s.tag) ?? [];
      liste.push(s);
      nachTag.set(s.tag, liste);
    }
    for (const liste of nachTag.values()) liste.sort((a, b) => a.beginn - b.beginn);
    return nachTag;
  });
  const heute = tagInBerlin(Date.now());
  const wochentage = () => kalender().tage.slice(0, 7);

  return (
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2" data-print-hidden="">
        <Show when={props.personen.length > 1}>
          <div class="w-56">
            <Feld
              label={m.plan_filter_person()}
              kind={(id) => (
                <select
                  id={id}
                  class={feld}
                  value={filterPerson()}
                  onChange={(e) => setFilterPerson(e.currentTarget.value)}
                >
                  <option value="">{m.plan_alle_personen()}</option>
                  <For each={props.personen}>
                    {(p) => <option value={p.nutzerId}>{p.name}</option>}
                  </For>
                </select>
              )}
            />
          </div>
        </Show>
      </div>
      <Loading>
        <div
          tabindex={0}
          class="overflow-x-auto rounded-xl border border-border bg-background focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <div class="grid min-w-[720px] grid-cols-7">
            <For each={wochentage()}>
              {(tag, idx) => (
                <div
                  class={cn(
                    "border-border border-b px-2.5 py-2 font-semibold text-[12px] text-muted-foreground",
                    idx() >= 5 && "bg-muted/50",
                  )}
                >
                  {wochentagKurz(tag)}
                </div>
              )}
            </For>
            <For each={kalender().tage}>
              {(tag, idx) => (
                <MonatsZelle
                  tag={tag}
                  imMonat={tag.startsWith(kalender().monat)}
                  wochenende={idx() % 7 >= 5}
                  istHeute={tag === heute}
                  schichten={schichtenNachTag().get(tag) ?? []}
                  vorlagen={props.vorlagen}
                  personenMap={personenMap()}
                  filterPerson={filterPerson()}
                  planer={props.planer}
                  onTagOeffnen={props.onTagOeffnen}
                  onOeffnen={props.onOeffnen}
                />
              )}
            </For>
          </div>
        </div>
      </Loading>
    </div>
  );
};

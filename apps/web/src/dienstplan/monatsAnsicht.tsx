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
import { tagDerZahl, wochentagKurz } from "./text.ts";
import type { Planperson, Schicht, Vorlage, Woche } from "./typen.ts";

const WOCHEN_SLOTS = [0, 1, 2, 3, 4, 5] as const;

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
  onOeffnen: (schicht: Schicht) => void;
  onTagOeffnen: (tag: Tag) => void;
}) => {
  const [filterPerson, setFilterPerson] = createSignal("");
  const kalender = createMemo(() => monatKalenderTage(props.tag));
  const heute = tagInBerlin(Date.now());

  // Fixed 6 query slots (a month spans 4..6 ISO weeks) so hooks never change count
  const wochenAbfragen = WOCHEN_SLOTS.map((idx) =>
    abfrage<Woche>(() => {
      const montag = kalender().montage[idx];
      return montag ? ressourcen.woche({ standortId: props.standortId, tag: montag }) : null;
    }),
  );

  const aktiveWochen = () => wochenAbfragen.slice(0, kalender().montage.length);

  const personenMap = createMemo(() => {
    const map = new Map<string, string>();
    for (const p of props.personen) map.set(p.nutzerId, p.name);
    for (const q of aktiveWochen()) {
      for (const p of daten(q.data)?.personen ?? []) map.set(p.nutzerId, p.name);
    }
    return map;
  });

  const schichtenNachTag = createMemo(() => {
    const gesehen = new Set<string>();
    const nachTag = new Map<Tag, Schicht[]>();
    const gewaehlt = filterPerson();
    for (const q of aktiveWochen()) {
      const w = daten(q.data);
      if (!w) continue;
      for (const s of w.schichten) {
        if (gesehen.has(s.schichtId)) continue;
        gesehen.add(s.schichtId);
        if (gewaehlt && s.nutzerId !== gewaehlt) continue;
        const liste = nachTag.get(s.tag) ?? [];
        liste.push(s);
        nachTag.set(s.tag, liste);
      }
    }
    for (const liste of nachTag.values()) liste.sort((a, b) => a.beginn - b.beginn);
    return nachTag;
  });

  const wochentage = createMemo(() => kalender().tage.slice(0, 7));

  return (
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <Show when={props.personen.length > 0}>
          <div class="w-full sm:w-60">
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
        <div class="overflow-x-auto rounded-xl border border-border bg-background">
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
              {(tag, idx) => {
                const imMonat = () => tag.startsWith(kalender().monat);
                const wochenende = () => idx() % 7 >= 5;
                const istHeute = () => tag === heute;
                const schichten = () => schichtenNachTag().get(tag) ?? [];
                return (
                  <div
                    class={cn(
                      "flex min-h-[112px] flex-col gap-1 border-border border-e border-b p-1.5 last:border-e-0",
                      wochenende() && "bg-muted/35",
                      !imMonat() && "bg-muted/25 text-muted-foreground",
                    )}
                  >
                    <div class="flex items-center justify-between">
                      <button
                        type="button"
                        class={cn(
                          "inline-flex size-6 items-center justify-center rounded-full font-mono text-[12px] tabular-nums transition-colors hover:bg-muted",
                          istHeute() &&
                            "bg-foreground font-semibold text-background hover:bg-foreground",
                        )}
                        onClick={() => props.onTagOeffnen(tag)}
                      >
                        {tagDerZahl(tag)}
                      </button>
                      <Show when={schichten().length > 0}>
                        <span class="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {schichten().length}
                        </span>
                      </Show>
                    </div>

                    <div class="flex flex-col gap-1">
                      <For each={schichten().slice(0, 4)} keyed={(s) => s.schichtId}>
                        {(schicht) => {
                          const farbe = () => schichtFarbe(schicht(), props.vorlagen);
                          const beschriftung = () => {
                            const start = uhrzeitText(schicht().beginn);
                            if (filterPerson())
                              return `${start} ${blockText(schicht(), props.vorlagen)}`;
                            const name =
                              schicht().nutzerId === null
                                ? m.plan_offen()
                                : (personenMap().get(schicht().nutzerId ?? "") ?? "");
                            return `${start} ${name}`;
                          };
                          return (
                            <Show
                              when={props.planer}
                              fallback={
                                <div
                                  class={cn(
                                    "truncate rounded-xs px-1.5 py-0.5 text-[11px] leading-tight",
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
                                  "w-full cursor-pointer truncate rounded-xs px-1.5 py-0.5 text-start text-[11px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-foreground",
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
                      <Show when={schichten().length > 4}>
                        <button
                          type="button"
                          class="px-1 text-start text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => props.onTagOeffnen(tag)}
                        >
                          +{schichten().length - 4}
                        </button>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Loading>
    </div>
  );
};

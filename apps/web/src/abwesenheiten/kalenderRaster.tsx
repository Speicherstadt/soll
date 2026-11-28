import type { Tag } from "@soll/arbeitszeit";
import { For, Show } from "solid-js";
import { tagDerZahl, wochentagKurz } from "../dienstplan/text.ts";
import { m } from "../paraglide/messages.js";
import { kalender, type Zelle } from "./kalender.ts";
import type { Team } from "./typen.ts";

const wochenende = (tag: Tag): boolean => {
  const wochentag = new Date(`${tag}T12:00:00Z`).getUTCDay();
  return wochentag === 0 || wochentag === 6;
};

/** A cell: „abwesend“ as a filled block or half of one, always with the word (DESIGN.md) */
const Feld = (props: { zelle: Zelle }) => (
  <Show when={props.zelle}>
    {(zelle) => (
      <span
        class={`block h-5 rounded-sm bg-primary ${zelle() === "halb" ? "w-1/2" : "w-full"}`}
        title={zelle() === "halb" ? m.abw_team_halb() : m.abw_art_abwesend()}
      >
        <span class="sr-only">{zelle() === "halb" ? m.abw_team_halb() : m.abw_art_abwesend()}</span>
      </span>
    )}
  </Show>
);

/**
 * The team calendar as a grid (S-402): a row per person away, a column per day; holidays of the
 * site and weekends on `--muted`. Only „abwesend“, no count per person (BetrVG § 87).
 */
export const Raster = (props: { team: Team }) => {
  const k = () => kalender(props.team.abwesenheiten, props.team.von, props.team.bis);
  const feiertag = (tag: Tag) => props.team.feiertage.find((f) => f.tag === tag);
  const frei = (tag: Tag) => wochenende(tag) || feiertag(tag) !== undefined;
  return (
    <Show when={k().zeilen.length > 0}>
      <div
        tabindex={0}
        class="overflow-x-auto focus-visible:outline-2 focus-visible:outline-foreground"
      >
        <table class="w-full min-w-[820px] table-fixed border-collapse text-[12px]">
          <caption class="sr-only">{m.abw_team_titel()}</caption>
          <thead>
            <tr>
              <th scope="col" class="w-28 p-1 text-start font-medium">
                {m.abw_team_person()}
              </th>
              <For each={k().tage}>
                {(tag) => (
                  <th
                    scope="col"
                    class={`p-0.5 text-center font-normal tabular-nums ${frei(tag) ? "bg-muted" : ""}`}
                    title={feiertag(tag)?.name}
                  >
                    <span class="block">{wochentagKurz(tag)}</span>
                    <span class="block">{tagDerZahl(tag)}</span>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={k().zeilen}>
              {(zeile) => (
                <tr class="border-border border-t">
                  <th scope="row" class="truncate p-1 text-start font-medium">
                    {zeile.name}
                  </th>
                  <For each={zeile.zellen} keyed={false}>
                    {(zelle, i) => (
                      <td class={`p-0.5 ${frei(k().tage[i] as Tag) ? "bg-muted" : ""}`}>
                        <Feld zelle={zelle()} />
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </Show>
  );
};

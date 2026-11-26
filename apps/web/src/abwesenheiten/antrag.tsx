import { Button, Checkbox } from "@soll/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Karte } from "./karte.tsx";
import { type AbwesenheitQuelle, BASIS } from "./quelle.ts";
import { ART, tageText, tagText } from "./text.ts";
import { ANTRAGSARTEN, type GeplanteSchicht } from "./typen.ts";

type Antwort = { urlaubHalbtage: number | null; eigeneSchichten: GeplanteSchicht[] };

/**
 * „Urlaub beantragen“: kind, first and last day, each may be half; the answer says how many days of
 * leave it takes (no weekends, no holidays) and names the person's own shifts in the span
 */
export const Antrag = (props: { quelle: AbwesenheitQuelle; heute: string }) => {
  const id = createUniqueId();
  const [schichten, setSchichten] = createSignal<GeplanteSchicht[]>([]);
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const daten = new FormData(form);
    const ok = await props.quelle.senden(
      () =>
        api<Antwort>(`${BASIS}/antrag`, {
          body: {
            art: String(daten.get("art")),
            von: String(daten.get("start")),
            bis: String(daten.get("end")),
            ersterHalb: daten.get("ersterHalb") === "on",
            letzterHalb: daten.get("letzterHalb") === "on",
          },
        }),
      (antwort) => {
        setSchichten(antwort.eigeneSchichten);
        return antwort.urlaubHalbtage
          ? m.abw_antrag_gesendet_tage({ tage: tageText(antwort.urlaubHalbtage) })
          : m.abw_antrag_gesendet();
      },
    );
    if (ok) form.reset();
  };
  return (
    <Karte titel={m.abw_antrag_titel()}>
      <form class="flex flex-col gap-3" onSubmit={absenden}>
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-art`} class="font-medium">
            {m.abw_art()}
          </label>
          <select id={`${id}-art`} name="art" class={feld}>
            <For each={ANTRAGSARTEN}>{(art) => <option value={art}>{ART[art]()}</option>}</For>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label for={`${id}-start`} class="font-medium">
              {m.abw_von()}
            </label>
            <input
              id={`${id}-start`}
              name="start"
              type="date"
              class={feld}
              defaultValue={props.heute}
              required
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for={`${id}-end`} class="font-medium">
              {m.abw_bis()}
            </label>
            <input
              id={`${id}-end`}
              name="end"
              type="date"
              class={feld}
              defaultValue={props.heute}
              required
            />
          </div>
        </div>
        <div class="flex flex-wrap gap-x-5 gap-y-2">
          <Checkbox name="ersterHalb" class="min-h-11">
            {m.abw_erster_halb()}
          </Checkbox>
          <Checkbox name="letzterHalb" class="min-h-11">
            {m.abw_letzter_halb()}
          </Checkbox>
        </div>
        <Show when={schichten().length > 0}>
          <p class="rounded-md bg-warning-surface px-3 py-2 text-foreground">
            {m.abw_schichten_hinweis({
              schichten: schichten()
                .map((s) => `${tagText(s.tag)} ${s.bezeichnung}`)
                .join(", "),
            })}
          </p>
        </Show>
        <div>
          <Button type="submit" disabled={props.quelle.arbeitet()}>
            {m.abw_antrag_titel()}
          </Button>
        </div>
      </form>
    </Karte>
  );
};

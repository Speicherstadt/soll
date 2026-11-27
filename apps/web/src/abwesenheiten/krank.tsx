import { Button, DatePicker } from "@soll/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { fristText } from "./frist.ts";
import { Karte } from "./karte.tsx";
import { type AbwesenheitQuelle, BASIS } from "./quelle.ts";
import { ART, zeitraumText } from "./text.ts";
import type { Abwesenheit } from "./typen.ts";

/** Children are named only by a number (Art. 5 Abs. 1 lit. c DSGVO) */
const KINDER = ["1", "2", "3", "4"] as const;

/** A sickness still running or ending today or later */
export const laufend = (a: Abwesenheit, heute: string) =>
  (a.art === "krank" || a.art === "kind_krank") &&
  a.status === "genehmigt" &&
  (a.bis === null || a.bis >= heute);

/** „Bescheinigung liegt vor“ as eAU or paper, and the last day once known */
const Laufend = (props: { a: Abwesenheit; quelle: AbwesenheitQuelle }) => {
  const id = createUniqueId();
  const setzen = (bescheinigung: string) =>
    props.quelle.senden(() =>
      api(`${BASIS}/${props.a.abwesenheitId}/bescheinigung`, {
        body: { bescheinigung: bescheinigung === "" ? null : bescheinigung },
      }),
    );
  const beenden = (event: SubmitEvent) => {
    event.preventDefault();
    const bis = String(new FormData(event.currentTarget as HTMLFormElement).get("bis"));
    void props.quelle.senden(() =>
      api(`${BASIS}/${props.a.abwesenheitId}/beenden`, { body: { bis } }),
    );
  };
  return (
    <div class="flex flex-col gap-3 rounded-lg border border-border p-3">
      <p class="font-medium">
        {ART[props.a.art]()} · {zeitraumText(props.a)}
      </p>
      <Show when={props.a.frist}>
        {(frist) => (
          <p class={frist().stand === "ueberfaellig" ? "text-warning" : "text-muted-foreground"}>
            {fristText(frist())}
          </p>
        )}
      </Show>
      <Show when={props.a.art === "krank"}>
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-b`} class="font-medium">
            {m.abw_bescheinigung()}
          </label>
          <select
            id={`${id}-b`}
            class={feld}
            onChange={(event) => void setzen(event.currentTarget.value)}
          >
            <option value="" selected={props.a.bescheinigung === null}>
              {m.abw_bescheinigung_keine()}
            </option>
            <option value="eau" selected={props.a.bescheinigung === "eau"}>
              {m.abw_bescheinigung_eau()}
            </option>
            <option value="papier" selected={props.a.bescheinigung === "papier"}>
              {m.abw_bescheinigung_papier()}
            </option>
          </select>
        </div>
      </Show>
      <form class="flex items-end gap-2" onSubmit={beenden}>
        <div class="flex flex-1 flex-col gap-1.5">
          <label for={`${id}-bis`} class="font-medium">
            {m.abw_beenden_label()}
          </label>
          <DatePicker
            id={`${id}-bis`}
            name="bis"
            defaultValue={props.a.bis ?? ""}
            min={props.a.von}
            required
          />
        </div>
        <Button type="submit" variant="outline">
          {m.abw_beenden()}
        </Button>
      </form>
    </div>
  );
};

/**
 * „Krank melden“: oneself or a child, from today, without a diagnosis; the hint on the certificate
 * names the day the business set (design/mockup/Abwesenheit.dc.html)
 */
export const Krank = (props: {
  quelle: AbwesenheitQuelle;
  abwesenheiten: Abwesenheit[];
  heute: string;
  abTag: number;
}) => {
  const id = createUniqueId();
  const [kind, setKind] = createSignal(false);
  const melden = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const daten = new FormData(form);
    const bis = String(daten.get("bis") ?? "");
    const ok = await props.quelle.senden(
      () =>
        api(`${BASIS}/krank`, {
          body: {
            art: kind() ? "kind_krank" : "krank",
            bis: bis === "" ? null : bis,
            kind: kind() ? String(daten.get("kind")) : null,
          },
        }),
      () => m.abw_krank_gemeldet(),
    );
    if (ok) form.reset();
  };
  const laufende = () => props.abwesenheiten.filter((a) => laufend(a, props.heute));
  return (
    <Karte titel={m.abw_krank_titel()}>
      <p class="text-muted-foreground">{m.abw_krank_text()}</p>
      <For each={laufende()}>{(a) => <Laufend a={a} quelle={props.quelle} />}</For>
      <form class="flex flex-col gap-3" onSubmit={melden}>
        <fieldset class="flex gap-5">
          <legend class="sr-only">{m.abw_krank_wer()}</legend>
          <label class="flex min-h-11 items-center gap-2">
            <input type="radio" name="wer" defaultChecked onChange={() => setKind(false)} />
            {m.abw_krank_ich()}
          </label>
          <label class="flex min-h-11 items-center gap-2">
            <input type="radio" name="wer" onChange={() => setKind(true)} />
            {m.abw_krank_kind()}
          </label>
        </fieldset>
        <Show when={kind()}>
          <div class="flex flex-col gap-1.5">
            <label for={`${id}-kind`} class="font-medium">
              {m.abw_kind()}
            </label>
            <select id={`${id}-kind`} name="kind" class={feld}>
              <For each={KINDER}>{(nr) => <option value={nr}>{m.abw_kind_nr({ nr })}</option>}</For>
            </select>
          </div>
        </Show>
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-bis`} class="font-medium">
            {m.abw_krank_bis()}
          </label>
          <DatePicker id={`${id}-bis`} name="bis" min={props.heute} />
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={props.quelle.arbeitet()}>
            {m.abw_krank_melden()}
          </Button>
        </div>
      </form>
      <p class="text-[12px] text-muted-foreground">
        {m.abw_frist_ab_tag({ tag: String(props.abTag) })}
      </p>
    </Karte>
  );
};

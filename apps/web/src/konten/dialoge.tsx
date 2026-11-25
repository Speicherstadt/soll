import { jahrVon } from "@soll/arbeitszeit";
import { Button, Dialog } from "@soll/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { aenderung } from "../abfragen/abfrage.ts";
import { alle, PFAD } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { GrundDialog } from "../monat/dialoge.tsx";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { halbtageAus, minutenAus } from "./eingabe.ts";
import { ART, FEHLER } from "./text.ts";
import type { Anpassungsart, Konten } from "./typen.ts";

/** A step on the accounts changes them, and nothing else */
const KONTEN_AENDERT = [alle(PFAD.konten)];

const pfad = (k: Konten, was: "hinweise" | "anpassungen") =>
  `${PFAD.konten}/${encodeURIComponent(k.nutzerId)}/${was}`;

/**
 * The day the owner told the person which leave is open and when it expires (§ 7 Abs. 3 BUrlG,
 * BAG 9 AZR 541/15): today by default, an earlier day for a notice given outside Soll
 */
export const HinweisDialog = (props: {
  k: Konten;
  onSchliessen: () => void;
  onGespeichert: () => void;
}) => {
  const [offen, setOffen] = createSignal(true);
  const [fehler, setFehler] = createSignal("");
  const id = createUniqueId();
  const senden = aenderung(
    (tag: string) => api(pfad(props.k, "hinweise"), { body: { tag } }),
    () => KONTEN_AENDERT,
  );
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const tag = String(new FormData(event.currentTarget as HTMLFormElement).get("tag") ?? "");
    const antwort = await senden.mutate(tag);
    if (!antwort.ok) return setFehler((FEHLER[antwort.fehler] ?? (() => m.fehler_speichern()))());
    setOffen(false);
    props.onGespeichert();
  };
  return (
    <Dialog offen={offen()} titel={m.konten_hinweis_titel()} onSchliessen={props.onSchliessen}>
      <form class="flex flex-col gap-3" onSubmit={absenden} novalidate>
        <p class="text-muted-foreground">{m.konten_hinweis_text({ name: props.k.name })}</p>
        <div class="flex flex-col gap-1.5">
          <label for={id} class="font-medium">
            {m.konten_hinweis_tag()}
          </label>
          <input
            id={id}
            name="tag"
            type="date"
            class={feld}
            value={props.k.heute}
            max={props.k.heute}
            required
          />
        </div>
        <Fehler text={fehler()} />
        <div class="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOffen(false)}>
            {m.abbrechen()}
          </Button>
          <Button type="submit" disabled={senden.isPending}>
            {m.konten_hinweis_speichern()}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

const ARTEN: readonly Anpassungsart[] = [
  "startsaldo",
  "auszahlung",
  "korrektur",
  "urlaub_start",
  "urlaub_korrektur",
];

const inStunden = (art: Anpassungsart) => !art.startsWith("urlaub");

/** What a change sends: a month and minutes, or a year and half days; null for what is no value */
const anfrageAus = (k: Konten, daten: FormData, grund: string) => {
  const art = String(daten.get("art")) as Anpassungsart;
  const wert = String(daten.get("wert") ?? "");
  if (inStunden(art)) {
    const minuten = minutenAus(wert);
    if (minuten === null) return null;
    return {
      pfad: pfad(k, "anpassungen"),
      body: { art, monat: daten.get("monat"), minuten, grund },
    };
  }
  const halbtage = halbtageAus(wert);
  if (halbtage === null) return null;
  return {
    pfad: pfad(k, "anpassungen"),
    body: { art, jahr: Number(daten.get("jahr")), halbtage, grund },
  };
};

/** The fields of a change: what, when (month or year), how much */
const AnpassungFelder = (props: { id: string; k: Konten }) => {
  const [art, setArt] = createSignal<Anpassungsart>("startsaldo");
  return (
    <>
      <div class="flex flex-col gap-1.5">
        <label for={`${props.id}-art`} class="font-medium">
          {m.konten_art()}
        </label>
        <select
          id={`${props.id}-art`}
          name="art"
          class={feld}
          onChange={(event) => setArt(event.currentTarget.value as Anpassungsart)}
        >
          <For each={ARTEN}>{(a) => <option value={a}>{ART[a]()}</option>}</For>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <Show
          when={inStunden(art())}
          fallback={
            <div class="flex flex-col gap-1.5">
              <label for={`${props.id}-jahr`} class="font-medium">
                {m.konten_jahr()}
              </label>
              <input
                id={`${props.id}-jahr`}
                name="jahr"
                type="number"
                class={feld}
                value={String(jahrVon(props.k.heute))}
              />
            </div>
          }
        >
          <div class="flex flex-col gap-1.5">
            <label for={`${props.id}-monat`} class="font-medium">
              {m.konten_monat()}
            </label>
            <input
              id={`${props.id}-monat`}
              name="monat"
              type="month"
              class={feld}
              value={props.k.heute.slice(0, 7)}
              max={props.k.heute.slice(0, 7)}
            />
          </div>
        </Show>
        <div class="flex flex-col gap-1.5">
          <label for={`${props.id}-wert`} class="font-medium">
            {inStunden(art()) ? m.konten_stunden() : m.konten_tage()}
          </label>
          <input id={`${props.id}-wert`} name="wert" class={feld} inputmode="text" required />
        </div>
      </div>
    </>
  );
};

/** A change of the accounts by hand, with a reason the person sees (docs/plan.md, "Konten") */
export const AnpassungDialog = (props: {
  k: Konten;
  onSchliessen: () => void;
  onGespeichert: () => void;
}) => (
  <GrundDialog
    titel={m.konten_anpassen()}
    text={m.konten_anpassen_text({ name: props.k.name })}
    knopf={m.konten_anpassung_speichern()}
    felder={(id) => <AnpassungFelder id={id} k={props.k} />}
    anfrage={(daten, grund) => anfrageAus(props.k, daten, grund)}
    fehlerText={FEHLER}
    betrifft={KONTEN_AENDERT}
    onSchliessen={props.onSchliessen}
    onGespeichert={props.onGespeichert}
  />
);

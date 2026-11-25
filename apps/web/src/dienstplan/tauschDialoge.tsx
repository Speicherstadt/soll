import { Button, Dialog } from "@soll/ui";
import { createSignal, For, untrack } from "solid-js";
import type { Antwort } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Feld } from "./felder.tsx";
import type { Schichtkopf, TauschAnsicht } from "./tausch.ts";
import { schichtZeile } from "./tauschText.ts";

type Senden = (auftrag: () => Promise<Antwort<unknown>>) => Promise<string>;

/**
 * Offering an own shift (S-504): which one, and to everyone who can take it or to one colleague.
 * It asks for no reason: whoever offers owes none, and a reason would invite health data.
 */
export const AnbietenDialog = (props: {
  schichten: readonly Schichtkopf[];
  kollegen: readonly { nutzerId: string; name: string }[];
  anbieten: (schichtId: string, an: string | null) => Promise<Antwort<unknown>>;
  senden: Senden;
  onSchliessen: () => void;
}) => {
  const [offen, setOffen] = createSignal(true);
  const [schichtId, setSchichtId] = createSignal(
    untrack(() => props.schichten[0]?.schichtId ?? ""),
  );
  const [an, setAn] = createSignal("");
  const [fehler, setFehler] = createSignal("");
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const text = await props.senden(() => props.anbieten(schichtId(), an() || null));
    setFehler(text);
    if (!text) setOffen(false);
  };
  return (
    <Dialog offen={offen()} titel={m.plan_tausch_anbieten()} onSchliessen={props.onSchliessen}>
      <form class="flex flex-col gap-3" onSubmit={absenden} novalidate>
        <p class="text-muted-foreground">{m.plan_tausch_anbieten_text()}</p>
        <Feld
          label={m.plan_tausch_schicht()}
          kind={(id) => (
            <select
              id={id}
              class={feld}
              value={schichtId()}
              onChange={(event) => setSchichtId(event.currentTarget.value)}
            >
              <For each={props.schichten}>
                {(schicht) => <option value={schicht.schichtId}>{schichtZeile(schicht)}</option>}
              </For>
            </select>
          )}
        />
        <Feld
          label={m.plan_tausch_an()}
          kind={(id) => (
            <select
              id={id}
              class={feld}
              value={an()}
              onChange={(event) => setAn(event.currentTarget.value)}
            >
              <option value="">{m.plan_tausch_an_alle()}</option>
              <For each={props.kollegen}>
                {(person) => <option value={person.nutzerId}>{person.name}</option>}
              </For>
            </select>
          )}
        />
        <Fehler text={fehler()} />
        <div class="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOffen(false)}>
            {m.abbrechen()}
          </Button>
          <Button type="submit">{m.plan_tausch_senden()}</Button>
        </div>
      </form>
    </Dialog>
  );
};

/** Refusing a swap (S-504): the reason is required, and both parties read it */
export const AblehnenDialog = (props: {
  tausch: TauschAnsicht;
  ablehnen: (tauschId: string, grund: string) => Promise<Antwort<unknown>>;
  senden: Senden;
  onSchliessen: () => void;
}) => {
  const [offen, setOffen] = createSignal(true);
  const [grund, setGrund] = createSignal("");
  const [fehler, setFehler] = createSignal("");
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!grund().trim()) return setFehler(m.plan_tausch_grund_fehlt());
    const text = await props.senden(() => props.ablehnen(props.tausch.tauschId, grund().trim()));
    setFehler(text);
    if (!text) setOffen(false);
  };
  return (
    <Dialog offen={offen()} titel={m.plan_tausch_ablehnen()} onSchliessen={props.onSchliessen}>
      <form class="flex flex-col gap-3" onSubmit={absenden} novalidate>
        <p>{schichtZeile(props.tausch.schicht)}</p>
        <Feld
          label={m.plan_tausch_grund()}
          hinweis={m.plan_tausch_grund_hinweis()}
          kind={(id, hinweisId) => (
            <textarea
              id={id}
              aria-describedby={hinweisId}
              required
              maxlength={500}
              rows={3}
              class={`${feld} h-auto py-2`}
              value={grund()}
              onInput={(event) => setGrund(event.currentTarget.value)}
            />
          )}
        />
        <Fehler text={fehler()} />
        <div class="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOffen(false)}>
            {m.abbrechen()}
          </Button>
          <Button type="submit">{m.plan_tausch_ablehnen()}</Button>
        </div>
      </form>
    </Dialog>
  );
};

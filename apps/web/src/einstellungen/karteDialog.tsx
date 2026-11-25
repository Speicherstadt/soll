import { Button, Dialog, Input } from "@soll/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { aenderung } from "../abfragen/abfrage.ts";
import { alle, PFAD } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { nfcLesen, nfcLeser } from "../terminal/nfc.ts";

export type Kartenart = "uid" | "ntag424";

const FEHLER: Record<string, () => string> = {
  karte_vergeben: () => m.terminal_karte_vergeben(),
  ungueltig: () => m.terminal_karte_ungueltig(),
};

/** A native select with its label, in the look of Input */
const Auswahl = (props: {
  label: string;
  name: string;
  wert?: string;
  onWahl?: (wert: string) => void;
  optionen: readonly { wert: string; text: string }[];
}) => {
  const id = createUniqueId();
  return (
    <div class="flex flex-col gap-1.5">
      <label for={id} class="font-medium">
        {props.label}
      </label>
      <select
        id={id}
        name={props.name}
        class={feld}
        value={props.wert}
        onChange={(event) => props.onWahl?.(event.currentTarget.value)}
      >
        <For each={props.optionen}>{(o) => <option value={o.wert}>{o.text}</option>}</For>
      </select>
    </div>
  );
};

/** Reads one card's UID on this device, where the browser has Web NFC (Chrome on Android) */
const uidLesen = (onUid: (uid: string) => void) => {
  const Leser = nfcLeser();
  if (!Leser) return;
  const abbruch = new AbortController();
  nfcLesen(Leser, abbruch.signal, (karte) => {
    if (!karte.uid) return;
    onUid(karte.uid);
    abbruch.abort();
  }).catch(() => abbruch.abort());
};

/**
 * Entering a card for a person (S-802): its kind, its UID, typed or read on this device, and for
 * an NTAG 424 DNA the two keys it was personalised with; the keys go to the server once and are
 * kept there encrypted, never shown again
 */
export const KarteDialog = (props: {
  offen: boolean;
  personen: readonly { nutzerId: string; name: string }[];
  onSchliessen: () => void;
}) => {
  const [art, setArt] = createSignal<Kartenart>("uid");
  const [uid, setUid] = createSignal("");
  const [fehler, setFehler] = createSignal("");
  const eintragen = aenderung(
    (body: Record<string, string>) => api(PFAD.terminalKarten, { body }),
    () => [alle(PFAD.terminalKarten)],
  );
  const schliessen = () => {
    setFehler("");
    setUid("");
    setArt("uid");
    props.onSchliessen();
  };
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const werte = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const antwort = await eintragen.mutate({ ...werte, art: art(), uid: uid() });
    if (!antwort.ok) return setFehler((FEHLER[antwort.fehler] ?? m.fehler_speichern)());
    form.reset();
    schliessen();
  };
  return (
    <Dialog offen={props.offen} titel={m.terminal_karte_eintragen()} onSchliessen={schliessen}>
      <form class="flex flex-col gap-3" onSubmit={absenden}>
        <Auswahl
          label={m.terminal_karte_person()}
          name="nutzerId"
          optionen={props.personen.map((p) => ({ wert: p.nutzerId, text: p.name }))}
        />
        <Auswahl
          label={m.terminal_karte_art()}
          name="art"
          wert={art()}
          onWahl={(wert) => setArt(wert as Kartenart)}
          optionen={[
            { wert: "uid", text: m.terminal_karte_art_uid() },
            { wert: "ntag424", text: m.terminal_karte_art_ntag() },
          ]}
        />
        <Input
          label={m.terminal_karte_uid()}
          hinweis={
            art() === "ntag424"
              ? m.terminal_karte_uid_hinweis_ntag()
              : m.terminal_karte_uid_hinweis()
          }
          value={uid()}
          onInput={(event) => setUid(event.currentTarget.value)}
          autocomplete="off"
          spellcheck={false}
          required
        />
        <Show when={nfcLeser()}>
          <Button variant="outline" onClick={() => uidLesen(setUid)}>
            {m.terminal_karte_lesen()}
          </Button>
        </Show>
        <Show when={art() === "ntag424"}>
          <Input label={m.terminal_karte_meta()} name="meta" autocomplete="off" required />
          <Input label={m.terminal_karte_datei()} name="datei" autocomplete="off" required />
        </Show>
        <Show when={fehler()}>
          <p role="alert" class="text-danger">
            {fehler()}
          </p>
        </Show>
        <div class="flex justify-end gap-2">
          <Button variant="outline" onClick={schliessen}>
            {m.abbrechen()}
          </Button>
          <Button type="submit" disabled={eintragen.isPending}>
            {m.terminal_speichern()}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

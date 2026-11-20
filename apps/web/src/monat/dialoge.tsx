import type { JSX } from "@solidjs/web";
import { ersterTag, type Monat } from "@soll/arbeitszeit";
import { Button, Dialog } from "@soll/ui";
import { createSignal, createUniqueId } from "solid-js";
import { type Antwort, api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { FEHLER } from "./text.ts";

/** A dialog with a form that asks for a reason and sends it; closes once the server took it */
const GrundDialog = (props: {
  titel: string;
  text: string;
  knopf: string;
  felder?: (id: string) => JSX.Element;
  senden: (daten: FormData, grund: string) => Promise<Antwort<unknown>> | null;
  onSchliessen: () => void;
  onGespeichert: (daten: unknown) => void;
}) => {
  const [offen, setOffen] = createSignal(true);
  const [fehler, setFehler] = createSignal("");
  const [arbeitet, setArbeitet] = createSignal(false);
  const id = createUniqueId();
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const daten = new FormData(event.currentTarget as HTMLFormElement);
    const grund = String(daten.get("grund") ?? "").trim();
    if (grund === "") return setFehler(m.monat_fehler_grund());
    const anfrage = props.senden(daten, grund);
    if (anfrage === null) return setFehler(m.fehler_speichern());
    setArbeitet(true);
    const antwort = await anfrage;
    setArbeitet(false);
    if (!antwort.ok) return setFehler((FEHLER[antwort.fehler] ?? (() => m.fehler_speichern()))());
    setOffen(false);
    props.onGespeichert(antwort.daten);
  };
  return (
    <Dialog offen={offen()} titel={props.titel} onSchliessen={props.onSchliessen}>
      <form class="flex flex-col gap-3" onSubmit={absenden} novalidate>
        <p class="text-muted-foreground">{props.text}</p>
        {props.felder?.(id)}
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-grund`} class="font-medium">
            {m.korrektur_grund()}
          </label>
          <textarea
            id={`${id}-grund`}
            name="grund"
            rows={2}
            maxlength={500}
            required
            class={`${feld} h-auto py-1.5`}
          />
        </div>
        <Fehler text={fehler()} />
        <div class="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOffen(false)}>
            {m.abbrechen()}
          </Button>
          <Button type="submit" disabled={arbeitet()}>
            {props.knopf}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

/** Closing without a valid confirmation of the person: only with a reason (docs/plan.md) */
export const OhneBestaetigungDialog = (props: {
  monat: Monat;
  nutzerId: string;
  name: string;
  onSchliessen: () => void;
  onGespeichert: (daten: unknown) => void;
}) => (
  <GrundDialog
    titel={m.monat_ohne_titel()}
    text={m.monat_ohne_text({ name: props.name })}
    knopf={m.monat_abschliessen()}
    senden={(_, grund) =>
      api("/api/v1/arbeitszeit/monat/abschliessen", {
        body: { monat: props.monat, nutzerId: props.nutzerId, grund },
      })
    }
    onSchliessen={props.onSchliessen}
    onGespeichert={props.onGespeichert}
  />
);

/**
 * A counter-entry to a day of a closed month: minutes with a sign and a reason; the month stays as
 * it was and keeps its Prüfwert (S-306)
 */
export const GegeneintragDialog = (props: {
  monat: Monat;
  nutzerId: string;
  onSchliessen: () => void;
  onGespeichert: () => void;
}) => (
  <GrundDialog
    titel={m.monat_gegeneintrag_titel()}
    text={m.monat_gegeneintrag_text()}
    knopf={m.korrektur_speichern()}
    felder={(id) => (
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-tag`} class="font-medium">
            {m.monat_spalte_tag()}
          </label>
          <input
            id={`${id}-tag`}
            name="tag"
            type="date"
            class={feld}
            value={ersterTag(props.monat)}
            required
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-minuten`} class="font-medium">
            {m.monat_gegeneintrag_minuten()}
          </label>
          <input id={`${id}-minuten`} name="minuten" type="number" step="1" class={feld} required />
        </div>
      </div>
    )}
    senden={(daten, grund) => {
      const minuten = Number(daten.get("minuten"));
      if (!Number.isSafeInteger(minuten) || minuten === 0) return null;
      return api("/api/v1/arbeitszeit/monat/gegeneintrag", {
        body: { nutzerId: props.nutzerId, tag: String(daten.get("tag")), minuten, grund },
      });
    }}
    onSchliessen={props.onSchliessen}
    onGespeichert={() => props.onGespeichert()}
  />
);

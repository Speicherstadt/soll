import {
  eingabeInBerlin,
  minuteInBerlin,
  STEMPELARTEN,
  type Stempelart,
  type Tag,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { Button, DatePicker, Dialog, TimePicker } from "@soll/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { aenderung } from "../abfragen/abfrage.ts";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { minuteAus } from "./aktionen.ts";
import { TAG_AENDERT } from "./quelle.ts";
import { ART_NAMEN } from "./text.ts";
import type { Stempel } from "./typen.ts";

/** What a correction does: add a stamp, change one, or remove one (S-304) */
export type Korrektur =
  | { modus: "nachtragen"; tag: Tag; nutzerId: string }
  | { modus: "aendern"; stempel: Stempel }
  | { modus: "entfernen"; stempel: Stempel };

const TITEL = {
  nachtragen: () => m.korrektur_titel_nachtragen(),
  aendern: () => m.korrektur_titel_aendern(),
  entfernen: () => m.korrektur_titel_entfernen(),
};

const zwei = (zahl: number) => String(zahl).padStart(2, "0");
const uhrzeitFeld = (ms: number) => {
  const minute = minuteInBerlin(ms);
  return `${zwei(Math.floor(minute / 60))}:${zwei(minute % 60)}`;
};

const FEHLER: Record<string, () => string> = {
  zukunft: () => m.korrektur_fehler_zukunft(),
  abgeschlossen: () => m.korrektur_fehler_abgeschlossen(),
  keine_berechtigung: () => m.korrektur_fehler_recht(),
  unbekannt: () => m.korrektur_fehler_veraltet(),
  veraltet: () => m.korrektur_fehler_veraltet(),
};

type Eingabe = { korrektur: Korrektur; art: Stempelart; zeitpunkt: number; grund: string };

/** The call a correction makes, with the instant the form names */
const senden = ({ korrektur, art, zeitpunkt, grund }: Eingabe) => {
  if (korrektur.modus === "nachtragen")
    return api("/api/v1/arbeitszeit/stempelungen/nachtrag", {
      body: { nutzerId: korrektur.nutzerId, art, zeitpunkt, grund },
    });
  const pfad = `/api/v1/arbeitszeit/stempelungen/${korrektur.stempel.stempelId}`;
  if (korrektur.modus === "entfernen") return api(`${pfad}/entfernen`, { body: { grund } });
  return api(pfad, { method: "PATCH", body: { art, zeitpunkt, grund } });
};

/**
 * Adding, changing or removing a stamp, always with a reason the person sees (docs/plan.md,
 * "Änderungen an Stempelungen"). Times are typed on a Berlin clock. Closes once the server took it
 * and the day shows the change.
 */
export const KorrekturDialog = (props: { korrektur: Korrektur; onSchliessen: () => void }) => {
  const [offen, setOffen] = createSignal(true);
  const [fehler, setFehler] = createSignal("");
  const speichern = aenderung(senden, () => TAG_AENDERT);
  const id = createUniqueId();
  const stempel = () => (props.korrektur.modus === "nachtragen" ? null : props.korrektur.stempel);
  const anfangTag = () => {
    const s = stempel();
    return s
      ? tagInBerlin(s.zeitpunkt)
      : props.korrektur.modus === "nachtragen"
        ? props.korrektur.tag
        : "";
  };
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const daten = new FormData(event.currentTarget as HTMLFormElement);
    const grund = String(daten.get("grund") ?? "").trim();
    if (grund === "") return setFehler(m.korrektur_fehler_grund());
    const minute = minuteAus(String(daten.get("uhrzeit") ?? ""));
    const zeitpunkt =
      props.korrektur.modus === "entfernen"
        ? props.korrektur.stempel.zeitpunkt
        : minute === null
          ? null
          : eingabeInBerlin(String(daten.get("datum") ?? ""), minute);
    if (zeitpunkt === null) return setFehler(m.korrektur_fehler_zeit());
    const art = (daten.get("art") as Stempelart | null) ?? stempel()?.art ?? "kommen";
    const antwort = await speichern.mutate({ korrektur: props.korrektur, art, zeitpunkt, grund });
    if (!antwort.ok) return setFehler((FEHLER[antwort.fehler] ?? (() => m.fehler_speichern()))());
    setOffen(false);
  };
  return (
    <Dialog
      offen={offen()}
      titel={TITEL[props.korrektur.modus]()}
      onSchliessen={props.onSchliessen}
    >
      <form class="flex flex-col gap-3" onSubmit={absenden} novalidate>
        <Show when={props.korrektur.modus !== "entfernen"}>
          <div class="flex flex-col gap-1.5">
            <label for={`${id}-art`} class="font-medium">
              {m.korrektur_art()}
            </label>
            <select id={`${id}-art`} name="art" class={feld} value={stempel()?.art ?? "kommen"}>
              <For each={STEMPELARTEN}>
                {(art) => <option value={art}>{ART_NAMEN[art]()}</option>}
              </For>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label for={`${id}-datum`} class="font-medium">
                {m.korrektur_datum()}
              </label>
              <DatePicker id={`${id}-datum`} name="datum" defaultValue={anfangTag()} required />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for={`${id}-uhrzeit`} class="font-medium">
                {m.korrektur_uhrzeit()}
              </label>
              <TimePicker
                id={`${id}-uhrzeit`}
                name="uhrzeit"
                defaultValue={(() => {
                  const s = stempel();
                  return s ? uhrzeitFeld(s.zeitpunkt) : "";
                })()}
                required
              />
            </div>
          </div>
        </Show>
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
            aria-describedby={`${id}-grund-hinweis`}
            class={`${feld} h-auto py-1.5`}
          />
          <p id={`${id}-grund-hinweis`} class="text-[12px] text-muted-foreground">
            {m.korrektur_grund_hinweis()}
          </p>
        </div>
        <Fehler text={fehler()} />
        <div class="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOffen(false)}>
            {m.abbrechen()}
          </Button>
          <Button type="submit" disabled={speichern.isPending}>
            {props.korrektur.modus === "entfernen"
              ? m.korrektur_entfernen()
              : m.korrektur_speichern()}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

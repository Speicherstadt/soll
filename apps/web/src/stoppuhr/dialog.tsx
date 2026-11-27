import { eingabeInBerlin, minuteInBerlin, plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { Button, DatePicker, Dialog, TimePicker } from "@soll/ui";
import { createSignal, createUniqueId, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { minuteAus } from "../zeiten/aktionen.ts";
import { Auswahl, wahlAus } from "./auswahl.tsx";
import type { BuchungFelder, StoppuhrAktionen, StoppuhrQuelle } from "./quelle.ts";
import { buchungFehler } from "./text.ts";
import type { Buchung } from "./typen.ts";

/** Change a booking, or add one by hand on a day */
export type BuchungBearbeiten =
  | { modus: "aendern"; buchung: Buchung }
  | { modus: "nachtragen"; tag: string };

const zwei = (zahl: number) => String(zahl).padStart(2, "0");
const uhrzeitFeld = (ms: number) => {
  const minute = minuteInBerlin(ms);
  return `${zwei(Math.floor(minute / 60))}:${zwei(minute % 60)}`;
};

/**
 * The instants a form names on a Berlin clock: an end before the begin lies on the next day (a
 * night shift); null for a time the day does not have
 */
const spanneAus = (daten: FormData, laeuft: boolean) => {
  const datum = String(daten.get("datum") ?? "");
  const von = minuteAus(String(daten.get("beginn") ?? ""));
  if (von === null) return null;
  const beginn = eingabeInBerlin(datum, von);
  if (beginn === null) return null;
  if (laeuft) return { beginn };
  const bis = minuteAus(String(daten.get("ende") ?? ""));
  if (bis === null) return null;
  const ende = eingabeInBerlin(bis <= von ? plusTage(datum, 1) : datum, bis);
  return ende === null ? null : { beginn, ende };
};

/** The dialog to change or add a booking; closes once the server took it and the day shows it */
export const BuchungDialog = (props: {
  bearbeiten: BuchungBearbeiten;
  quelle: StoppuhrQuelle;
  aktionen: StoppuhrAktionen;
  onSchliessen: () => void;
}) => {
  const [offen, setOffen] = createSignal(true);
  const [fehler, setFehler] = createSignal("");
  const id = createUniqueId();
  const buchung = () => (props.bearbeiten.modus === "aendern" ? props.bearbeiten.buchung : null);
  const laeuft = () => buchung()?.ende === null;
  const tag = () => {
    const b = buchung();
    return b
      ? tagInBerlin(b.beginn)
      : props.bearbeiten.modus === "nachtragen"
        ? props.bearbeiten.tag
        : "";
  };
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const daten = new FormData(event.currentTarget as HTMLFormElement);
    const spanne = spanneAus(daten, laeuft());
    if (spanne === null) return setFehler(m.buchung_fehler_zeit());
    const felder: BuchungFelder = {
      ...wahlAus(daten),
      ...spanne,
      notiz: String(daten.get("notiz") ?? "").trim(),
    };
    const b = buchung();
    const antwort = b
      ? await props.aktionen.aendern(b.buchungId, felder)
      : await props.aktionen.nachtragen(felder);
    if (!antwort.ok) return setFehler(buchungFehler(antwort.fehler));
    setOffen(false);
  };
  return (
    <Dialog
      offen={offen()}
      titel={buchung() ? m.buchung_titel_aendern() : m.buchung_titel_nachtragen()}
      onSchliessen={props.onSchliessen}
    >
      <form class="flex flex-col gap-3" onSubmit={absenden} novalidate>
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-datum`} class="font-medium">
            {m.buchung_datum()}
          </label>
          <DatePicker id={`${id}-datum`} name="datum" value={tag()} required />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label for={`${id}-beginn`} class="font-medium">
              {m.buchung_beginn()}
            </label>
            <TimePicker
              id={`${id}-beginn`}
              name="beginn"
              value={(() => {
                const b = buchung();
                return b ? uhrzeitFeld(b.beginn) : "";
              })()}
              required
            />
          </div>
          <Show when={!laeuft()}>
            <div class="flex flex-col gap-1.5">
              <label for={`${id}-ende`} class="font-medium">
                {m.buchung_ende()}
              </label>
              <TimePicker
                id={`${id}-ende`}
                name="ende"
                value={(() => {
                  const ende = buchung()?.ende;
                  return ende == null ? "" : uhrzeitFeld(ende);
                })()}
                required
              />
            </div>
          </Show>
        </div>
        <Auswahl
          projekte={props.quelle.projekte()}
          taetigkeiten={props.quelle.taetigkeiten()}
          projektId={buchung()?.projektId ?? null}
          taetigkeitId={buchung()?.taetigkeitId}
        />
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-notiz`} class="font-medium">
            {m.stoppuhr_notiz()}
          </label>
          <input
            id={`${id}-notiz`}
            name="notiz"
            class={feld}
            maxlength={500}
            value={buchung()?.notiz ?? ""}
          />
        </div>
        <Fehler text={fehler()} />
        <div class="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOffen(false)}>
            {m.abbrechen()}
          </Button>
          <Button type="submit" disabled={props.aktionen.arbeitet()}>
            {m.buchung_speichern()}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

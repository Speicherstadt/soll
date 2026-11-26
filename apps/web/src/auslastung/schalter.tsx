import { Checkbox } from "@soll/ui";
import { createSignal, createUniqueId, Show } from "solid-js";
import { aenderung } from "../abfragen/abfrage.ts";
import { alle, PFAD } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { aktuellerBetrieb, sitzungNeu } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";
import { zeitpunktText } from "../zeiten/text.ts";

/**
 * The switch of the utilisation per person (S-604): the owner switches it, the server writes it
 * into the audit chain; the planner sees how it stands. Switched, the session is asked again, so
 * every page shows the notice at once.
 */
export const JePersonSchalter = () => {
  const id = createUniqueId();
  const [fehler, setFehler] = createSignal("");
  const darf = () => {
    const betrieb = aktuellerBetrieb();
    return betrieb !== null && istInhaber(betrieb);
  };
  const seit = () => aktuellerBetrieb()?.auswertungJePersonSeit ?? null;
  const schalten = aenderung(
    (jePerson: boolean) =>
      api<{ jePersonSeit: number | null }>("/api/v1/projektzeit/auslastung/einstellung", {
        method: "PUT",
        body: { jePerson },
      }),
    () => [alle(PFAD.auslastung), alle(PFAD.auslastungPersonen), alle(PFAD.auslastungIch)],
  );
  const umschalten = async (an: boolean, feld: HTMLInputElement) => {
    const antwort = await schalten.mutate(an);
    if (!antwort.ok) {
      feld.checked = !an;
      return setFehler(antwort.status === 0 ? m.fehler_netz() : m.fehler_speichern());
    }
    setFehler("");
    await sitzungNeu();
  };
  return (
    <div class="flex max-w-xl flex-col gap-2">
      <Checkbox
        class="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
        boxClass="mt-1"
        checked={seit() !== null}
        disabled={!darf()}
        aria-describedby={`${id}-text`}
        onChange={(event) => umschalten(event.currentTarget.checked, event.currentTarget)}
      >
        <span class="flex flex-col">
          <span class="font-medium">{m.auslastung_je_person()}</span>
          <span id={`${id}-text`} class="text-muted-foreground">
            {darf() ? m.auslastung_je_person_text() : m.auslastung_je_person_nur_inhaber()}
          </span>
          <Show when={seit()}>
            {(am) => (
              <span class="text-muted-foreground">
                {m.auslastung_je_person_seit({ seit: zeitpunktText(am()) })}
              </span>
            )}
          </Show>
        </span>
      </Checkbox>
      <Fehler text={fehler()} />
    </div>
  );
};

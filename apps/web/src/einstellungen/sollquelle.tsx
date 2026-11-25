import { tagInBerlin } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { createSignal, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { Feld } from "../dienstplan/felder.tsx";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";

type Quelle = "modell" | "plan";
type Stand = { quellen: { ab: string; quelle: Quelle }[]; fruehestens: string | null };

const NAMEN: Record<Quelle, () => string> = {
  modell: () => m.target_source_model(),
  plan: () => m.target_source_plan(),
};

/** The first of next month, or the first day after the last closed month if that is later */
const vorschlag = (fruehestens: string | null): string => {
  const heute = tagInBerlin(Date.now());
  const naechster = `${heute.slice(0, 7)}-01`;
  return fruehestens !== null && fruehestens > naechster ? fruehestens : naechster;
};

/**
 * Soll aus dem Plan (S-505): from a day on the target of each day is the person's published shifts
 * instead of the model. Only the owner sets it, never into a closed month, and the plan only with
 * the module Dienstplan.
 */
export const SollquelleEinstellung = () => {
  const inhaber = () => {
    const betrieb = aktuellerBetrieb();
    return betrieb !== null && istInhaber(betrieb);
  };
  const stand = abfrage<Stand>(() => (inhaber() ? ressourcen.sollquellen() : null));
  const [quelle, setQuelle] = createSignal<Quelle>("plan");
  const [ab, setAb] = createSignal("");
  const [fehler, setFehler] = createSignal("");
  const speichern = aenderung(
    (eingabe: { ab: string; quelle: Quelle }) =>
      api(PFAD.sollquellen, { method: "PUT", body: eingabe }),
    () => [alle(PFAD.sollquellen), alle(PFAD.monat)],
  );
  const absenden = async (event: SubmitEvent, s: Stand) => {
    event.preventDefault();
    const antwort = await speichern.mutate({
      ab: ab() || vorschlag(s.fruehestens),
      quelle: quelle(),
    });
    setFehler(
      antwort.ok
        ? ""
        : antwort.fehler === "monat_gesperrt"
          ? m.target_source_earliest({ tag: s.fruehestens ?? "" })
          : antwort.fehler === "dienstplan_aus"
            ? m.target_source_needs_plan()
            : m.fehler_speichern(),
    );
  };
  return (
    <Show when={inhaber()}>
      <Loading>
        <Show when={daten(stand.data)}>
          {(s) => (
            <section class="flex max-w-sm flex-col gap-3">
              <h2 class="font-semibold">{m.target_source_title()}</h2>
              <p class="text-muted-foreground">{m.target_source_text()}</p>
              <Show when={s().quellen.at(-1)}>
                {(letzte) => (
                  <p role="status">
                    {m.target_source_now({ quelle: NAMEN[letzte().quelle](), tag: letzte().ab })}
                  </p>
                )}
              </Show>
              <form class="flex flex-col gap-3" onSubmit={(e) => void absenden(e, s())} novalidate>
                <Feld
                  label={m.target_source_title()}
                  kind={(id) => (
                    <select
                      id={id}
                      class={feld}
                      value={quelle()}
                      onChange={(e) => setQuelle(e.currentTarget.value as Quelle)}
                    >
                      <option value="plan">{NAMEN.plan()}</option>
                      <option value="modell">{NAMEN.modell()}</option>
                    </select>
                  )}
                />
                <Feld
                  label={m.target_source_from()}
                  kind={(id) => (
                    <input
                      id={id}
                      type="date"
                      class={feld}
                      min={s().fruehestens ?? undefined}
                      value={ab() || vorschlag(s().fruehestens)}
                      onChange={(e) => setAb(e.currentTarget.value)}
                    />
                  )}
                />
                <Button type="submit" variant="outline" class="self-start">
                  {m.plan_speichern()}
                </Button>
              </form>
              <Fehler text={fehler()} />
            </section>
          )}
        </Show>
      </Loading>
    </Show>
  );
};

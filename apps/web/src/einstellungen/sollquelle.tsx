import { tagInBerlin } from "@soll/arbeitszeit";
import { Button, DatePicker } from "@soll/ui";
import { createMemo, createSignal, Loading, Show } from "solid-js";
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

/** The first of the current month, or the first day after the last closed month if that is later */
const vorschlag = (fruehestens: string | null): string => {
  const heute = tagInBerlin(Date.now());
  const erster = `${heute.slice(0, 7)}-01`;
  return fruehestens !== null && fruehestens > erster ? fruehestens : erster;
};

/**
 * Soll aus dem Plan (S-505): lets the owner choose whether daily target hours come from the
 * working-time model or from published shifts in the shift plan, effective from a day after the
 * last closed month.
 */
export const SollquelleEinstellung = () => {
  const inhaber = createMemo(() => {
    const betrieb = aktuellerBetrieb();
    return betrieb !== null && istInhaber(betrieb);
  });
  const stand = abfrage<Stand>(() => (inhaber() ? ressourcen.sollquellen() : null));
  const [quelle, setQuelle] = createSignal<Quelle>("plan");
  const [ab, setAb] = createSignal("");
  const [fehler, setFehler] = createSignal("");
  const [status, setStatus] = createSignal("");
  const speichern = aenderung(
    (eingabe: { ab: string; quelle: Quelle }) =>
      api<Stand>(PFAD.sollquellen, { method: "PUT", body: eingabe }),
    () => [alle(PFAD.sollquellen), alle(PFAD.monat), alle(PFAD.tag)],
  );
  const absenden = async (event: SubmitEvent, s: Stand) => {
    event.preventDefault();
    setStatus("");
    const antwort = await speichern.mutate({
      ab: ab() || vorschlag(s.fruehestens),
      quelle: quelle(),
    });
    if (antwort.ok) {
      setFehler("");
      setStatus(m.target_source_saved());
      return;
    }
    setFehler(
      antwort.fehler === "monat_gesperrt"
        ? m.target_source_earliest({ date: s.fruehestens ?? "" })
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
            <section class="flex flex-col gap-3">
              <h2 class="font-semibold">{m.target_source_title()}</h2>
              <p class="text-muted-foreground">{m.target_source_text()}</p>
              <Show when={s().quellen.at(-1)}>
                {(letzte) => (
                  <p class="text-sm font-medium" role="status">
                    {m.target_source_now({
                      source: NAMEN[letzte().quelle](),
                      date: letzte().ab,
                    })}
                  </p>
                )}
              </Show>
              <form class="flex flex-col gap-3" onSubmit={(e) => void absenden(e, s())} novalidate>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Feld
                    label={m.target_source_title()}
                    kind={(id) => (
                      <select
                        id={id}
                        class={feld}
                        value={quelle()}
                        onChange={(e) => {
                          setStatus("");
                          setQuelle(e.currentTarget.value as Quelle);
                        }}
                      >
                        <option value="plan">{NAMEN.plan()}</option>
                        <option value="modell">{NAMEN.modell()}</option>
                      </select>
                    )}
                  />
                  <Feld
                    label={m.target_source_from()}
                    kind={(id) => (
                      <DatePicker
                        id={id}
                        {...(s().fruehestens ? { min: s().fruehestens as string } : {})}
                        value={ab() || vorschlag(s().fruehestens)}
                        onValue={(wert) => {
                          setStatus("");
                          setAb(wert);
                        }}
                      />
                    )}
                  />
                </div>
                <Fehler text={fehler()} />
                <div class="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={speichern.isPending}>
                    {m.plan_speichern()}
                  </Button>
                  <p class="text-success" aria-live="polite">
                    {status()}
                  </p>
                </div>
              </form>
            </section>
          )}
        </Show>
      </Loading>
    </Show>
  );
};

import { BRANCHEN, type Branche } from "@soll/arbeitszeit";
import { Button, DatePicker } from "@soll/ui";
import { createMemo, createSignal, For, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { Feld } from "../dienstplan/felder.tsx";
import { PLAN_AENDERT } from "../dienstplan/quelle.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";

/** The settings the rules read (GET and PUT /api/v1/betrieb/pruefung, S-502) */
type Einstellungen = {
  branche: Branche | null;
  sonntagsausnahme: number | null;
  ausgleichszeitraum: "sechs_monate" | "24_wochen" | null;
  ausgleichBeginn: string | null;
};

const BRANCHEN_NAMEN: Record<Branche, () => string> = {
  krankenhaus_pflege: m.branche_krankenhaus_pflege,
  gastronomie_beherbergung: m.branche_gastronomie_beherbergung,
  verkehr: m.branche_verkehr,
  rundfunk: m.branche_rundfunk,
  landwirtschaft_tierhaltung: m.branche_landwirtschaft_tierhaltung,
  andere: m.branche_andere,
};

/** § 10 Abs. 1 Nr. 1 to 16 ArbZG */
const NUMMERN = Array.from({ length: 16 }, (_, index) => index + 1);

const ZEITRAEUME = [
  ["", m.pruefung_ausgleich_beide],
  ["sechs_monate", m.pruefung_ausgleich_sechs_monate],
  ["24_wochen", m.pruefung_ausgleich_24_wochen],
] as const;

/** A select whose empty value stands for "no setting", the default of the law */
const Auswahl = (props: {
  label: string;
  wert: string;
  optionen: readonly (readonly [string, string])[];
  onWert: (wert: string) => void;
}) => (
  <Feld
    label={props.label}
    kind={(id) => (
      <select
        id={id}
        class={feld}
        value={props.wert}
        onChange={(event) => props.onWert(event.currentTarget.value)}
      >
        <For each={props.optionen}>{([wert, text]) => <option value={wert}>{text}</option>}</For>
      </select>
    )}
  />
);

/**
 * The settings of the checks (docs/plan.md, "Einstellungen zur Prüfung"): the industry of § 5 Abs. 2
 * ArbZG, the exception for Sundays and holidays of § 10 Abs. 1 ArbZG and the Ausgleichszeitraum of
 * § 3 ArbZG. Without a setting the law's strict default holds; only the owner changes them.
 */
export const PruefungEinstellungen = () => {
  // a memo: a new session (a module switched) that leaves the owner the owner keeps the edits
  const darf = createMemo(() => {
    const betrieb = aktuellerBetrieb();
    return betrieb !== null && istInhaber(betrieb);
  });
  // only the owner changes them, so only the owner asks for them
  const gespeichert = abfrage<Einstellungen>(() => (darf() ? ressourcen.pruefung() : null));
  // the form starts from what is stored and is edited from there
  const [werte, setWerte] = createSignal<Einstellungen | null>(() =>
    darf() ? (daten(gespeichert.data) ?? null) : null,
  );
  const [fehler, setFehler] = createSignal("");
  const [status, setStatus] = createSignal("");
  // the settings change the findings in the plan
  const sichern = aenderung(
    (neu: Einstellungen | null) => api<Einstellungen>(PFAD.pruefung, { method: "PUT", body: neu }),
    () => [alle(PFAD.pruefung), ...PLAN_AENDERT],
  );
  const setze = (teil: Partial<Einstellungen>) => {
    setStatus("");
    setWerte((alt) => (alt ? { ...alt, ...teil } : alt));
  };
  const speichern = async (event: SubmitEvent) => {
    event.preventDefault();
    const antwort = await sichern.mutate(werte());
    setFehler(antwort.ok ? "" : m.fehler_speichern());
    if (antwort.ok) setStatus(m.pruefung_gespeichert());
  };
  return (
    <Loading>
      <Show when={werte()}>
        {(aktuell) => (
          <section class="flex flex-col gap-3">
            <h2 class="font-semibold">{m.pruefung_titel()}</h2>
            <p class="text-muted-foreground">{m.pruefung_text()}</p>
            <form class="flex flex-col gap-4" onSubmit={speichern} novalidate>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Auswahl
                  label={m.pruefung_branche()}
                  wert={aktuell().branche ?? ""}
                  optionen={[
                    ["", m.pruefung_keine()],
                    ...BRANCHEN.map((b) => [b, BRANCHEN_NAMEN[b]()] as const),
                  ]}
                  onWert={(wert) => setze({ branche: (wert || null) as Branche | null })}
                />
                <Auswahl
                  label={m.pruefung_sonntag()}
                  wert={String(aktuell().sonntagsausnahme ?? "")}
                  optionen={[
                    ["", m.pruefung_keine()],
                    ...NUMMERN.map((n) => [String(n), m.pruefung_nummer({ nummer: n })] as const),
                  ]}
                  onWert={(wert) => setze({ sonntagsausnahme: wert ? Number(wert) : null })}
                />
                <Auswahl
                  label={m.pruefung_ausgleich()}
                  wert={aktuell().ausgleichszeitraum ?? ""}
                  optionen={ZEITRAEUME.map(([wert, text]) => [wert, text()] as const)}
                  onWert={(wert) =>
                    setze({
                      ausgleichszeitraum: (wert || null) as Einstellungen["ausgleichszeitraum"],
                    })
                  }
                />
                <Feld
                  label={m.pruefung_beginn()}
                  kind={(id) => (
                    <DatePicker
                      id={id}
                      value={aktuell().ausgleichBeginn ?? ""}
                      onValue={(wert) => setze({ ausgleichBeginn: wert || null })}
                    />
                  )}
                />
              </div>
              <Fehler text={fehler()} />
              <div class="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={sichern.isPending}>
                  {m.pruefung_speichern()}
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
  );
};

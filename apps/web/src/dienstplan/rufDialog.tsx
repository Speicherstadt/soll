import type { Tag } from "@soll/arbeitszeit";
import { Button, Dialog } from "@soll/ui";
import { createSignal, For, untrack } from "solid-js";
import { schreiben } from "../abfragen/abfrage.ts";
import type { Antwort } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Feld, ZeitFeld } from "./felder.tsx";
import { PLAN_AENDERT } from "./quelle.ts";
import { type RufEingabe, rufAendern, rufAnlegen, rufEingabeVon, rufEntfernen } from "./ruf.ts";
import type { Planperson, Rufdienst } from "./typen.ts";

export type RufModus = { art: "neu"; tag: Tag } | { art: "bearbeiten"; rufdienst: Rufdienst };

const FEHLER: Record<string, () => string> = {
  zeit_gibt_es_nicht: () => m.plan_fehler_zeit(),
  ungueltig: () => m.plan_fehler_eingabe(),
};

const startwerte = (modus: RufModus, standortId: string): RufEingabe =>
  modus.art === "bearbeiten"
    ? rufEingabeVon(modus.rufdienst)
    : {
        standortId,
        nutzerId: "",
        tag: modus.tag,
        beginnMinute: 18 * 60,
        endeMinute: 6 * 60,
        reaktionMinuten: null,
      };

/** The reaction time as typed: empty for none, else whole minutes up to a day */
const reaktionAus = (text: string): number | null => {
  if (text.trim() === "") return null;
  const zahl = Math.trunc(Number(text));
  return Number.isFinite(zahl) ? Math.min(24 * 60, Math.max(0, zahl)) : null;
};

/**
 * Planning or changing a Rufbereitschaft (S-505): a person, a day, the times on the clock (an end
 * at or before the start on the next day) and the reaction time if one is agreed. A draft until
 * the week is published, like a shift (S-503).
 */
export const RufDialog = (props: {
  modus: RufModus;
  standortId: string;
  personen: readonly Planperson[];
  onSchliessen: () => void;
}) => {
  const modus = untrack(() => props.modus);
  const [offen, setOffen] = createSignal(true);
  const [werte, setWerte] = createSignal(untrack(() => startwerte(modus, props.standortId)));
  const [fehler, setFehler] = createSignal("");
  const setze = (teil: Partial<RufEingabe>) => setWerte((alt) => ({ ...alt, ...teil }));
  const senden = schreiben(() => PLAN_AENDERT);
  const fertig = async (auftrag: () => Promise<Antwort<unknown>>) => {
    const ergebnis = await senden.mutate(auftrag);
    if (!ergebnis.ok) return setFehler((FEHLER[ergebnis.fehler] ?? (() => m.fehler_speichern()))());
    setOffen(false);
  };
  const absenden = (event: SubmitEvent) => {
    event.preventDefault();
    const eingabe = werte();
    if (eingabe.nutzerId === "") return setFehler(m.oncall_person_needed());
    void fertig(() =>
      modus.art === "neu" ? rufAnlegen(eingabe) : rufAendern(modus.rufdienst.rufdienstId, eingabe),
    );
  };
  return (
    <Dialog
      offen={offen()}
      titel={modus.art === "neu" ? m.oncall_add() : m.oncall_edit()}
      onSchliessen={props.onSchliessen}
    >
      <form class="flex flex-col gap-3" onSubmit={absenden} novalidate>
        <div class="grid grid-cols-2 gap-3">
          <Feld
            label={m.plan_tag()}
            kind={(id) => (
              <input
                id={id}
                type="date"
                class={feld}
                required
                value={werte().tag}
                onChange={(event) =>
                  event.currentTarget.value && setze({ tag: event.currentTarget.value })
                }
              />
            )}
          />
          <Feld
            label={m.plan_person()}
            kind={(id) => (
              <select
                id={id}
                class={feld}
                required
                value={werte().nutzerId}
                onChange={(event) => setze({ nutzerId: event.currentTarget.value })}
              >
                <option value="" />
                <For each={props.personen}>
                  {(p) => <option value={p.nutzerId}>{p.name}</option>}
                </For>
              </select>
            )}
          />
          <ZeitFeld
            label={m.plan_beginn()}
            minute={werte().beginnMinute}
            onMinute={(beginnMinute) => setze({ beginnMinute })}
          />
          <ZeitFeld
            label={m.plan_ende()}
            minute={werte().endeMinute}
            onMinute={(endeMinute) => setze({ endeMinute })}
          />
        </div>
        <p class="text-[12px] text-muted-foreground">{m.plan_ende_hinweis()}</p>
        <Feld
          label={m.oncall_response()}
          hinweis={m.oncall_response_hint()}
          kind={(id, hinweisId) => (
            <input
              id={id}
              type="number"
              inputmode="numeric"
              min={0}
              max={1440}
              step="1"
              class={feld}
              aria-describedby={hinweisId}
              value={werte().reaktionMinuten ?? ""}
              onChange={(event) =>
                setze({ reaktionMinuten: reaktionAus(event.currentTarget.value) })
              }
            />
          )}
        />
        <Fehler text={fehler()} />
        <div class="flex flex-wrap justify-end gap-2">
          {modus.art === "bearbeiten" && (
            <Button
              variant="outline"
              class="me-auto text-danger"
              onClick={() => void fertig(() => rufEntfernen(modus.rufdienst.rufdienstId))}
            >
              {m.plan_entfernen()}
            </Button>
          )}
          <Button variant="outline" onClick={() => setOffen(false)}>
            {m.abbrechen()}
          </Button>
          <Button type="submit">{m.plan_speichern()}</Button>
        </div>
      </form>
    </Dialog>
  );
};

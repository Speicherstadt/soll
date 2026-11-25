import { schichtZeiten, type Tag } from "@soll/arbeitszeit";
import { Button, Dialog } from "@soll/ui";
import { createSignal, untrack } from "solid-js";
import { Feld, ZeitFeld } from "../dienstplan/felder.tsx";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { einsatzAktionen, einsatzFehler } from "./quelle.ts";

type Werte = { tag: Tag; beginnMinute: number; endeMinute: number; grund: string };

/**
 * Adding a call-out afterwards (S-505): the day it began, from the call to the way back, an end at
 * or before the start on the next day, and why it is added by hand, as for a stamp (S-304)
 */
export const NachtragDialog = (props: { tag: Tag; onSchliessen: () => void }) => {
  const [offen, setOffen] = createSignal(true);
  const [werte, setWerte] = createSignal<Werte>(
    untrack(() => ({ tag: props.tag, beginnMinute: 22 * 60, endeMinute: 23 * 60, grund: "" })),
  );
  const [fehler, setFehler] = createSignal("");
  const setze = (teil: Partial<Werte>) => setWerte((alt) => ({ ...alt, ...teil }));
  const { nachtragen } = einsatzAktionen();
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const { tag, beginnMinute, endeMinute, grund } = werte();
    const zeiten = schichtZeiten(tag, beginnMinute, endeMinute);
    if (!zeiten) return setFehler(m.plan_fehler_zeit());
    if (grund.trim() === "") return setFehler(m.plan_fehler_eingabe());
    const antwort = await nachtragen.mutate({ ...zeiten, grund: grund.trim() });
    if (!antwort.ok) return setFehler(einsatzFehler(antwort.fehler));
    setOffen(false);
  };
  return (
    <Dialog offen={offen()} titel={m.callout_add()} onSchliessen={props.onSchliessen}>
      <form class="flex flex-col gap-3" onSubmit={(event) => void absenden(event)} novalidate>
        <Feld
          label={m.callout_day()}
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
        <div class="grid grid-cols-2 gap-3">
          <ZeitFeld
            label={m.callout_from()}
            minute={werte().beginnMinute}
            onMinute={(beginnMinute) => setze({ beginnMinute })}
          />
          <ZeitFeld
            label={m.callout_until()}
            minute={werte().endeMinute}
            onMinute={(endeMinute) => setze({ endeMinute })}
          />
        </div>
        <p class="text-[12px] text-muted-foreground">{m.plan_ende_hinweis()}</p>
        <Feld
          label={m.callout_reason()}
          kind={(id) => (
            <input
              id={id}
              class={feld}
              required
              maxlength={500}
              value={werte().grund}
              onInput={(event) => setze({ grund: event.currentTarget.value })}
            />
          )}
        />
        <Fehler text={fehler()} />
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setOffen(false)}>
            {m.abbrechen()}
          </Button>
          <Button type="submit">{m.callout_save()}</Button>
        </div>
      </form>
    </Dialog>
  );
};

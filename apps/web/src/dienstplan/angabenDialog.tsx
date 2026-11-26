import { Button, Checkbox, Dialog } from "@soll/ui";
import { createSignal, For, Loading, untrack } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Feld } from "./felder.tsx";
import { PLAN_AENDERT } from "./quelle.ts";
import type { Planperson } from "./typen.ts";

/** What the rules need of a person (GET and PUT /api/v1/personen/:id/angaben, S-502) */
type Angaben = {
  geburtsdatum: string | null;
  wechselschicht: boolean;
  abruf: boolean;
  mutterschutz: { von: string; bis: string | null }[];
};

const LEER: Angaben = { geburtsdatum: null, wechselschicht: false, abruf: false, mutterschutz: [] };

/** A date field that may stay empty */
const DatumFeld = (props: { label: string; wert: string; onWert: (wert: string) => void }) => (
  <Feld
    label={props.label}
    kind={(id) => (
      <input
        id={id}
        type="date"
        class={feld}
        value={props.wert}
        onChange={(event) => props.onWert(event.currentTarget.value)}
      />
    )}
  />
);

const Haken = (props: { label: string; wert: boolean; onWert: (wert: boolean) => void }) => (
  <Checkbox checked={props.wert} onChange={(event) => props.onWert(event.currentTarget.checked)}>
    {props.label}
  </Checkbox>
);

/**
 * The data of a person the rules need, for the owner (docs/plan.md, "Daten zur Person"): birth date
 * (JArbSchG), Wechselschicht (§ 2 Abs. 5 ArbZG), work on call (§ 12 TzBfG) and one span of the
 * Mutterschutz, without asking whether pregnant or breastfeeding (Art. 9 DSGVO)
 */
export const AngabenDialog = (props: {
  personen: readonly Planperson[];
  onSchliessen: () => void;
}) => {
  const [offen, setOffen] = createSignal(true);
  const [nutzerId, setNutzerId] = createSignal(untrack(() => props.personen[0]?.nutzerId ?? ""));
  const geladen = abfrage<Angaben>(() => (nutzerId() ? ressourcen.angaben(nutzerId()) : null));
  // the form starts from what is stored for the person chosen and is edited from there
  const [angaben, setAngaben] = createSignal<Angaben>(() =>
    nutzerId() ? (daten(geladen.data) ?? LEER) : LEER,
  );
  const [fehler, setFehler] = createSignal("");
  const [status, setStatus] = createSignal("");
  // the data of a person changes the findings in the plan
  const sichern = aenderung(
    (eingabe: { nutzerId: string; angaben: Angaben }) =>
      api(`/api/v1/personen/${encodeURIComponent(eingabe.nutzerId)}/angaben`, {
        method: "PUT",
        body: eingabe.angaben,
      }),
    () => [alle(PFAD.angaben), ...PLAN_AENDERT],
  );
  const waehlen = (id: string) => {
    setStatus("");
    setNutzerId(id);
  };
  const setze = (teil: Partial<Angaben>) => setAngaben((alt) => ({ ...alt, ...teil }));
  const spanne = () => angaben().mutterschutz[0] ?? { von: "", bis: null };
  const setzeSpanne = (von: string, bis: string | null) =>
    setze({ mutterschutz: von ? [{ von, bis: bis || null }] : [] });
  const speichern = async (event: SubmitEvent) => {
    event.preventDefault();
    const antwort = await sichern.mutate({ nutzerId: nutzerId(), angaben: angaben() });
    setFehler(antwort.ok ? "" : m.plan_fehler_eingabe());
    if (antwort.ok) setStatus(m.plan_angaben_gespeichert());
  };
  return (
    <Dialog offen={offen()} titel={m.plan_angaben()} onSchliessen={props.onSchliessen}>
      <form class="flex flex-col gap-3" onSubmit={speichern} novalidate>
        <p class="text-muted-foreground">{m.plan_angaben_text()}</p>
        <Feld
          label={m.plan_person()}
          kind={(id) => (
            <select
              id={id}
              class={feld}
              value={nutzerId()}
              onChange={(e) => waehlen(e.currentTarget.value)}
            >
              <For each={props.personen}>
                {(person) => <option value={person.nutzerId}>{person.name}</option>}
              </For>
            </select>
          )}
        />
        <Loading>
          <DatumFeld
            label={m.plan_angaben_geburtsdatum()}
            wert={angaben().geburtsdatum ?? ""}
            onWert={(wert) => setze({ geburtsdatum: wert || null })}
          />
          <Haken
            label={m.plan_angaben_wechselschicht()}
            wert={angaben().wechselschicht}
            onWert={(wechselschicht) => setze({ wechselschicht })}
          />
          <Haken
            label={m.plan_angaben_abruf()}
            wert={angaben().abruf}
            onWert={(abruf) => setze({ abruf })}
          />
          <fieldset class="m-0 grid grid-cols-2 gap-3 border-0 p-0">
            <legend class="mb-1.5 font-medium">{m.plan_angaben_mutterschutz()}</legend>
            <DatumFeld
              label={m.plan_angaben_von()}
              wert={spanne().von}
              onWert={(von) => setzeSpanne(von, spanne().bis)}
            />
            <DatumFeld
              label={m.plan_angaben_bis()}
              wert={spanne().bis ?? ""}
              onWert={(bis) => setzeSpanne(spanne().von, bis)}
            />
          </fieldset>
        </Loading>
        <Fehler text={fehler()} />
        <p class="text-success" aria-live="polite">
          {status()}
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setOffen(false)}>
            {m.plan_schliessen()}
          </Button>
          <Button type="submit" disabled={sichern.isPending || geladen.isFetching}>
            {m.plan_speichern()}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

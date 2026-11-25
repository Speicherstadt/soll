import { Badge, Button } from "@soll/ui";
import { createSignal, For, Loading, Show } from "solid-js";
import { abfrage, daten, schreiben } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import type { Antwort } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { befundKurz } from "./befunde.ts";
import { BefundIcon } from "./block.tsx";
import {
  type Aktion,
  aktionenFuer,
  TAUSCH_AENDERT,
  type TauschAnsicht,
  type Tauschbuch,
  tauschAblehnen,
  tauschAnbieten,
  tauschregelSetzen,
  tauschSchritt,
  tauschZurueckziehen,
} from "./tausch.ts";
import { AblehnenDialog, AnbietenDialog } from "./tauschDialoge.tsx";
import { beteiligteText, fehlerText, schichtZeile, statusText, statusTon } from "./tauschText.ts";

type Ich = { nutzerId: string; planer: boolean };

const AKTION_TEXT: Record<Aktion, () => string> = {
  uebernehmen: m.plan_tausch_uebernehmen,
  zurueckziehen: m.plan_tausch_zurueckziehen,
  freigeben: m.plan_tausch_freigeben,
  ablehnen: m.plan_tausch_ablehnen,
};

/** The findings of the check for whoever took the shift: for whoever approves only (Art. 9 DSGVO) */
const Befunde = (props: { tausch: TauschAnsicht }) => (
  <Show when={props.tausch.befunde}>
    {(befunde) => (
      <Show
        when={befunde().length > 0}
        fallback={<p class="text-[13px] text-success">{m.plan_tausch_befunde_keine()}</p>}
      >
        <ul class="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
          <For each={befunde()}>
            {(befund) => (
              <li class="flex items-start gap-1.5" data-regel={befund.regel}>
                <BefundIcon befunde={[befund]} />
                <span>{befundKurz(befund)}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    )}
  </Show>
);

/** One swap: its state in words, the shift, who offered and took it, a refusal's reason, the steps */
const Eintrag = (props: {
  tausch: TauschAnsicht;
  ich: Ich;
  onAktion: (aktion: Aktion) => void;
}) => (
  <li class="flex flex-col gap-1.5 rounded-md border border-border px-3 py-2">
    <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <Badge ton={statusTon(props.tausch.status)}>{statusText(props.tausch.status)}</Badge>
      <span class="font-medium">{schichtZeile(props.tausch.schicht)}</span>
    </div>
    <span class="text-muted-foreground">{beteiligteText(props.tausch)}</span>
    <Show when={props.tausch.grund}>
      {(grund) => <span>{m.plan_tausch_grund_anzeige({ grund: grund() })}</span>}
    </Show>
    <Befunde tausch={props.tausch} />
    <Show when={aktionenFuer(props.tausch, props.ich).length > 0}>
      <div class="flex flex-wrap gap-2">
        <For each={aktionenFuer(props.tausch, props.ich)}>
          {(aktion) => (
            <Button
              variant={aktion === "uebernehmen" || aktion === "freigeben" ? "primary" : "outline"}
              size="sm"
              onClick={() => props.onAktion(aktion)}
            >
              {AKTION_TEXT[aktion]()}
            </Button>
          )}
        </For>
      </div>
    </Show>
  </li>
);

/** The owner's setting: a takeover holds at once while the check finds no Verstoß */
const OhneFreigabe = (props: { wert: boolean; onWert: (wert: boolean) => void }) => (
  <label class="flex items-start gap-2">
    <input
      type="checkbox"
      class="mt-1"
      checked={props.wert}
      onChange={(event) => props.onWert(event.currentTarget.checked)}
    />
    {m.plan_tausch_ohne_freigabe()}
  </label>
);

/**
 * "Schichttausch" below the plan (S-504): the own shifts to offer, the offers meant for the person,
 * the own swaps with their state; for whoever plans every swap with the check for whoever took it,
 * to approve or refuse; for the owner whether a swap needs approval
 */
export const TauschBereich = (props: { ich: Ich; inhaber: boolean }) => {
  const buch = abfrage<Tauschbuch>(() => ressourcen.tausch());
  const geladen = () => daten(buch.data);
  const [anbieten, setAnbieten] = createSignal(false);
  const [abzulehnen, setAbzulehnen] = createSignal<TauschAnsicht | null>(null);
  const [fehler, setFehler] = createSignal("");
  // the swaps and the weeks load again after each step, whether the server took it or not
  const schritt = schreiben(() => TAUSCH_AENDERT, { immer: true });
  /** Sends a step and answers what went wrong, in words, or nothing */
  const senden = async (auftrag: () => Promise<Antwort<unknown>>): Promise<string> => {
    const antwort = await schritt.mutate(auftrag);
    return antwort.ok ? "" : fehlerText(antwort.fehler);
  };
  const ausfuehren = async (tausch: TauschAnsicht, aktion: Aktion) => {
    if (aktion === "ablehnen") return setAbzulehnen(tausch);
    const auftrag =
      aktion === "zurueckziehen"
        ? () => tauschZurueckziehen(tausch.tauschId)
        : () => tauschSchritt(tausch.tauschId, aktion);
    setFehler(await senden(auftrag));
  };
  return (
    <section aria-labelledby="plan-tausch-titel" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-tausch-titel" class="font-semibold text-[15px]">
          {m.plan_tausch_titel()}
        </h2>
        <Show when={(geladen()?.anbietbar.length ?? 0) > 0}>
          <Button variant="outline" onClick={() => setAnbieten(true)}>
            {m.plan_tausch_anbieten()}
          </Button>
        </Show>
      </div>
      <Loading>
        <Show when={props.inhaber}>
          <OhneFreigabe
            wert={geladen()?.ohneFreigabe ?? false}
            onWert={(wert) => void senden(() => tauschregelSetzen(wert)).then(setFehler)}
          />
        </Show>
        <Fehler text={fehler() || (buch.data.ok ? "" : m.laden_fehler())} />
        <Show
          when={(geladen()?.tausche.length ?? 0) > 0}
          fallback={<p class="text-muted-foreground">{m.plan_tausch_leer()}</p>}
        >
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            <For each={geladen()?.tausche ?? []}>
              {(tausch) => (
                <Eintrag
                  tausch={tausch}
                  ich={props.ich}
                  onAktion={(aktion) => void ausfuehren(tausch, aktion)}
                />
              )}
            </For>
          </ul>
        </Show>
      </Loading>
      <Show when={anbieten() && geladen()}>
        {(jetzt) => (
          <AnbietenDialog
            schichten={jetzt().anbietbar}
            kollegen={jetzt().kollegen}
            anbieten={tauschAnbieten}
            senden={senden}
            onSchliessen={() => setAnbieten(false)}
          />
        )}
      </Show>
      <Show when={abzulehnen()}>
        {(tausch) => (
          <AblehnenDialog
            tausch={tausch()}
            ablehnen={tauschAblehnen}
            senden={senden}
            onSchliessen={() => setAbzulehnen(null)}
          />
        )}
      </Show>
    </section>
  );
};

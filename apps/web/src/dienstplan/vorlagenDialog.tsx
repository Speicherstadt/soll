import { Button, Dialog } from "@soll/ui";
import { createSignal, For, Show } from "solid-js";
import { schreiben } from "../abfragen/abfrage.ts";
import { alle, PFAD } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { TextFeld, ZahlFeld, ZeitFeld } from "./felder.tsx";
import { minutenSpanne } from "./text.ts";
import type { Vorlage } from "./typen.ts";

type Entwurf = Omit<Vorlage, "vorlageId" | "standortId">;

const LEER: Entwurf = {
  name: "",
  beginnMinute: 8 * 60,
  endeMinute: 16 * 60,
  pauseMinuten: 30,
  rolle: "",
};

/** The templates with a button to change and one to remove each */
const VorlagenListe = (props: {
  vorlagen: readonly Vorlage[];
  onBearbeiten: (vorlage: Vorlage) => void;
  onEntfernen: (vorlage: Vorlage) => void;
}) => (
  <Show
    when={props.vorlagen.length > 0}
    fallback={<p class="text-muted-foreground">{m.plan_vorlagen_leer()}</p>}
  >
    <ul class="m-0 flex list-none flex-col gap-1 p-0">
      <For each={props.vorlagen}>
        {(vorlage) => (
          <li class="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-1.5">
            <span class="font-medium">{vorlage.name}</span>
            <span class="font-mono text-[12px]" dir="ltr">
              {minutenSpanne(vorlage.beginnMinute, vorlage.endeMinute)}
            </span>
            <span class="me-auto">{vorlage.rolle}</span>
            <Button variant="ghost" size="sm" onClick={() => props.onBearbeiten(vorlage)}>
              {m.plan_vorlage_bearbeiten({ name: vorlage.name })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="text-danger"
              onClick={() => props.onEntfernen(vorlage)}
            >
              {m.plan_vorlage_entfernen({ name: vorlage.name })}
            </Button>
          </li>
        )}
      </For>
    </ul>
  </Show>
);

/** The fields of a template */
const VorlageFelder = (props: { entwurf: Entwurf; setze: (teil: Partial<Entwurf>) => void }) => (
  <div class="grid grid-cols-2 gap-3">
    <TextFeld
      label={m.plan_vorlage_name()}
      wert={props.entwurf.name}
      onWert={(name) => props.setze({ name })}
    />
    <TextFeld
      label={m.plan_rolle()}
      wert={props.entwurf.rolle}
      onWert={(rolle) => props.setze({ rolle })}
    />
    <ZeitFeld
      label={m.plan_beginn()}
      minute={props.entwurf.beginnMinute}
      onMinute={(beginnMinute) => props.setze({ beginnMinute })}
    />
    <ZeitFeld
      label={m.plan_ende()}
      minute={props.entwurf.endeMinute}
      onMinute={(endeMinute) => props.setze({ endeMinute })}
    />
    <ZahlFeld
      label={m.plan_pause()}
      wert={props.entwurf.pauseMinuten}
      min={0}
      max={1439}
      onWert={(pauseMinuten) => props.setze({ pauseMinuten })}
    />
  </div>
);

/**
 * The shift templates of the business (S-501): add, change and remove. A shift planned from a
 * template keeps its own times when the template changes later.
 */
export const VorlagenDialog = (props: {
  vorlagen: readonly Vorlage[];
  onSchliessen: () => void;
}) => {
  const [offen, setOffen] = createSignal(true);
  const [bearbeitet, setBearbeitet] = createSignal<string | null>(null);
  const [entwurf, setEntwurf] = createSignal<Entwurf>(LEER);
  const [fehler, setFehler] = createSignal("");
  const waehlen = (vorlage: Vorlage | null) => {
    setBearbeitet(vorlage?.vorlageId ?? null);
    setEntwurf(
      vorlage
        ? {
            name: vorlage.name,
            beginnMinute: vorlage.beginnMinute,
            endeMinute: vorlage.endeMinute,
            pauseMinuten: vorlage.pauseMinuten,
            rolle: vorlage.rolle,
          }
        : LEER,
    );
  };
  // the list comes from the plan's query, which loads again after each change
  const aendern = schreiben(() => [alle(PFAD.vorlagen)]);
  const ergebnis = (ok: boolean, text: string) => {
    setFehler(ok ? "" : text);
    return ok;
  };
  const speichern = async (event: SubmitEvent) => {
    event.preventDefault();
    const neu = { ...entwurf(), name: entwurf().name.trim(), rolle: entwurf().rolle.trim() };
    if (neu.name === "") return setFehler(m.plan_fehler_name());
    const id = bearbeitet();
    const pfad = id ? `/api/v1/dienstplan/vorlagen/${id}` : "/api/v1/dienstplan/vorlagen";
    const antwort = await aendern.mutate(() =>
      api(pfad, { method: id ? "PUT" : "POST", body: neu }),
    );
    if (ergebnis(antwort.ok, m.plan_fehler_eingabe())) waehlen(null);
  };
  const entfernen = async (vorlage: Vorlage) => {
    const antwort = await aendern.mutate(() =>
      api(`/api/v1/dienstplan/vorlagen/${vorlage.vorlageId}`, { method: "DELETE" }),
    );
    if (ergebnis(antwort.ok, m.fehler_speichern()) && bearbeitet() === vorlage.vorlageId)
      waehlen(null);
  };
  return (
    <Dialog offen={offen()} titel={m.plan_vorlagen()} onSchliessen={props.onSchliessen}>
      <div class="flex flex-col gap-4">
        <VorlagenListe
          vorlagen={props.vorlagen}
          onBearbeiten={waehlen}
          onEntfernen={(v) => void entfernen(v)}
        />
        <form
          class="flex flex-col gap-3 border-border border-t pt-4"
          onSubmit={speichern}
          novalidate
        >
          <h3 class="font-semibold">
            {bearbeitet() ? m.plan_vorlage_aendern() : m.plan_vorlage_neu()}
          </h3>
          <VorlageFelder
            entwurf={entwurf()}
            setze={(teil) => setEntwurf((alt) => ({ ...alt, ...teil }))}
          />
          <Fehler text={fehler()} />
          <div class="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOffen(false)}>
              {m.plan_schliessen()}
            </Button>
            <Button type="submit">
              {bearbeitet() ? m.plan_speichern() : m.plan_vorlage_neu()}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};

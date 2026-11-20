import { Button, Icon, Input } from "@soll/ui";
import { Trash2 } from "lucide";
import { createSignal, For, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten, listeAendern } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { type Antwort, api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Fuss, SchrittKopf } from "./geruest.tsx";
import { VORLAGE_NAMEN } from "./namen.ts";
import { VORLAGEN, type Vorlage } from "./vorlagen.ts";
import { centAus, dauerText, euroText, minutenAus, verteilen } from "./werte.ts";
import { ZuschlagFelder, zuschlaegeAus } from "./zuschlagFelder.tsx";

type Modell = {
  modellId: string;
  name: string;
  sollMinuten: number[];
  lohnArt: "monat" | "stunde";
  lohnCent: number | null;
  minijob: boolean;
};

const VORLAGE_TEXTE: Record<Vorlage["id"], () => string> = {
  vollzeit: m.vorlage_vollzeit_text,
  teilzeit: m.vorlage_teilzeit_text,
  minijob: m.vorlage_minijob_text,
};

const wochenText = (modell: Modell) => {
  const summe = modell.sollMinuten.reduce((a, b) => a + b, 0);
  return summe > 0 ? m.modell_woche({ dauer: dauerText(summe) }) : m.modell_nach_plan();
};

const lohnText = (modell: Modell) =>
  modell.lohnCent === null
    ? m.nicht_hinterlegt()
    : (modell.lohnArt === "monat" ? m.modell_lohn_monat : m.modell_lohn_stunde)({
        betrag: euroText(modell.lohnCent, getLocale()),
      });

type Eingabe = Omit<Modell, "modellId"> & {
  zuschlagssaetze: NonNullable<ReturnType<typeof zuschlaegeAus>>;
};

/** What a change to the models changes: the models as loaded (here and on Zeiten) */
const MODELLE_AENDERT = [alle(PFAD.modelle)];

/** A template: the owner changes only what differs (hours a week, the wage) and takes it */
const VorlageKarte = (props: {
  vorlage: Vorlage;
  anlegen: (eingabe: Eingabe) => Promise<Antwort<Modell>>;
  arbeitet: boolean;
}) => {
  const [fehler, setFehler] = createSignal("");
  const name = () => VORLAGE_NAMEN[props.vorlage.id]();
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const daten = new FormData(event.currentTarget as HTMLFormElement);
    const stunden = daten.get("stunden");
    const minuten = stunden === null ? 0 : minutenAus(String(stunden));
    const lohnText = String(daten.get("lohn")).trim();
    const lohnCent = lohnText === "" ? null : centAus(lohnText);
    const zuschlagssaetze = zuschlaegeAus(daten);
    if (minuten === null) return setFehler(m.fehler_stunden());
    if (lohnCent === null && lohnText !== "") return setFehler(m.fehler_betrag());
    if (zuschlagssaetze === null) return setFehler(m.fehler_prozent());
    // a second click while the first is on its way would create the model twice
    if (props.arbeitet) return;
    const antwort = await props.anlegen({
      name: name(),
      sollMinuten: verteilen(minuten, props.vorlage.tage),
      lohnArt: props.vorlage.lohnArt,
      lohnCent,
      minijob: props.vorlage.minijob,
      zuschlagssaetze,
    });
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    setFehler("");
  };
  return (
    <form
      aria-label={name()}
      class="flex flex-col gap-3 rounded-lg bg-muted p-3"
      onSubmit={absenden}
    >
      <div class="flex flex-col gap-0.5">
        <span class="font-semibold">{name()}</span>
        <span class="text-muted-foreground">{VORLAGE_TEXTE[props.vorlage.id]()}</span>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Show when={props.vorlage.wochenMinuten > 0}>
          <Input
            label={m.modell_stunden()}
            hinweis={m.modell_stunden_hinweis()}
            name="stunden"
            inputmode="numeric"
            value={dauerText(props.vorlage.wochenMinuten)}
            required
          />
        </Show>
        <Input
          label={props.vorlage.lohnArt === "monat" ? m.modell_gehalt() : m.modell_stundenlohn()}
          hinweis={m.modell_lohn_hinweis()}
          name="lohn"
          inputmode="decimal"
        />
      </div>
      <ZuschlagFelder />
      <Fehler text={fehler()} />
      <Button type="submit" variant="outline" class="self-start" disabled={props.arbeitet}>
        {m.modell_uebernehmen({ name: name() })}
      </Button>
    </form>
  );
};

/** Step 3: working-time models from the templates Vollzeit, Teilzeit and Minijob */
export const ModelleSchritt = (props: {
  nummer: number;
  anzahl: number;
  zurueck?: (() => void) | undefined;
  weiter: () => void;
}) => {
  const modelleAbfrage = abfrage<{ modelle: Modell[] }>(ressourcen.modelle);
  const modelle = () => daten(modelleAbfrage.data)?.modelle ?? [];
  const [fehler, setFehler] = createSignal("");
  const anlegen = aenderung(
    (eingabe: Eingabe) => api<Modell>("/api/v1/arbeitszeit/modelle", { body: eingabe }),
    () => MODELLE_AENDERT,
    {
      eintragen: (client, _, neu) =>
        listeAendern<Modell>(client, ressourcen.modelle(), "modelle", (liste) => [...liste, neu]),
    },
  );
  const entfernen = aenderung(
    (modell: Modell) => api(`/api/v1/arbeitszeit/modelle/${modell.modellId}`, { method: "DELETE" }),
    () => MODELLE_AENDERT,
    {
      eintragen: (client, weg) =>
        listeAendern<Modell>(client, ressourcen.modelle(), "modelle", (liste) =>
          liste.filter((x) => x.modellId !== weg.modellId),
        ),
    },
  );
  const arbeitet = () => anlegen.isPending;
  // before the list has loaded, it is read as empty, as the page shows it
  const weiter = () =>
    !modelleAbfrage.isPending && modelle().length > 0
      ? props.weiter()
      : setFehler(m.modell_fehlt());
  return (
    <>
      <SchrittKopf id="schritt-titel" titel={m.modelle_titel()} text={m.modelle_text()} />
      <Loading>
        <Show when={modelle().length > 0}>
          <ul
            aria-label={m.modelle_liste()}
            class="flex flex-col divide-y divide-border rounded-lg border border-border"
          >
            <For each={modelle()}>
              {(modell) => (
                <li class="flex items-center justify-between gap-3 px-3 py-2">
                  <span class="flex min-w-0 flex-col">
                    <span class="font-medium">{modell.name}</span>
                    <span class="text-muted-foreground">{`${wochenText(modell)} · ${lohnText(modell)}`}</span>
                  </span>
                  <Button
                    variant="icon"
                    aria-label={m.modell_entfernen({ name: modell.name })}
                    onClick={() => void entfernen.mutate(modell)}
                  >
                    <Icon icon={Trash2} />
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Loading>
      <div class="flex flex-col gap-3">
        <For each={VORLAGEN}>
          {(vorlage) => (
            <VorlageKarte
              vorlage={vorlage}
              arbeitet={arbeitet()}
              anlegen={async (eingabe) => {
                const antwort = await anlegen.mutate(eingabe);
                if (antwort.ok) setFehler("");
                return antwort;
              }}
            />
          )}
        </For>
      </div>
      <Fehler text={fehler()} />
      <Fuss
        nummer={props.nummer}
        anzahl={props.anzahl}
        zurueck={props.zurueck}
        weiter={weiter}
        arbeitet={arbeitet()}
      />
    </>
  );
};

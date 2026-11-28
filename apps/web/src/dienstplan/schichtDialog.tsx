import { Button, DatePicker, Dialog } from "@soll/ui";
import { createSignal, For, untrack } from "solid-js";
import { schreiben } from "../abfragen/abfrage.ts";
import type { Antwort } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Feld, TextFeld, ZahlFeld, ZeitFeld } from "./felder.tsx";
import {
  eingabeVon,
  PLAN_AENDERT,
  type SchichtEingabe,
  schichtAendern,
  schichtAnlegen,
  schichtEntfernen,
} from "./quelle.ts";
import type { Planperson, Schicht, Vorlage, Ziel } from "./typen.ts";

export type SchichtModus = { art: "neu"; ziel: Ziel } | { art: "bearbeiten"; schicht: Schicht };

const FEHLER: Record<string, () => string> = {
  zeit_gibt_es_nicht: () => m.plan_fehler_zeit(),
  pause_zu_lang: () => m.plan_fehler_pause(),
  monat_abgeschlossen: () => m.plan_fehler_abgeschlossen(),
  ungueltig: () => m.plan_fehler_eingabe(),
};

const startwerte = (modus: SchichtModus, standortId: string): SchichtEingabe =>
  modus.art === "bearbeiten"
    ? eingabeVon(modus.schicht)
    : {
        standortId,
        tag: modus.ziel.tag,
        nutzerId: modus.ziel.nutzerId,
        beginnMinute: 8 * 60,
        endeMinute: 16 * 60,
        pauseMinuten: 30,
        rolle: "",
        vorlageId: null,
      };

type Felder = {
  werte: SchichtEingabe;
  setze: (teil: Partial<SchichtEingabe>) => void;
  personen: readonly Planperson[];
  vorlagen: readonly Vorlage[];
  rollen: readonly string[];
};

/** The fields of a shift: template, day, person or open, times, break and role */
const SchichtFelder = (props: Felder) => {
  const vorlageWaehlen = (vorlageId: string) => {
    const vorlage = props.vorlagen.find((v) => v.vorlageId === vorlageId);
    if (!vorlage) return props.setze({ vorlageId: null });
    const { beginnMinute, endeMinute, pauseMinuten, rolle } = vorlage;
    props.setze({ vorlageId, beginnMinute, endeMinute, pauseMinuten, rolle });
  };
  return (
    <>
      <Feld
        label={m.plan_vorlage()}
        kind={(id) => (
          <select
            id={id}
            class={feld}
            value={props.werte.vorlageId ?? ""}
            onChange={(event) => vorlageWaehlen(event.currentTarget.value)}
          >
            <option value="">{m.plan_ohne_vorlage()}</option>
            <For each={props.vorlagen}>{(v) => <option value={v.vorlageId}>{v.name}</option>}</For>
          </select>
        )}
      />
      <div class="grid grid-cols-2 gap-3">
        <Feld
          label={m.plan_tag()}
          kind={(id) => (
            <DatePicker
              id={id}
              required
              value={props.werte.tag}
              onValue={(wert) => wert && props.setze({ tag: wert })}
            />
          )}
        />
        <Feld
          label={m.plan_person()}
          kind={(id) => (
            <select
              id={id}
              class={feld}
              value={props.werte.nutzerId ?? ""}
              onChange={(event) => props.setze({ nutzerId: event.currentTarget.value || null })}
            >
              <option value="">{m.plan_offen()}</option>
              <For each={props.personen}>{(p) => <option value={p.nutzerId}>{p.name}</option>}</For>
            </select>
          )}
        />
        <ZeitFeld
          label={m.plan_beginn()}
          minute={props.werte.beginnMinute}
          onMinute={(beginnMinute) => props.setze({ beginnMinute })}
        />
        <ZeitFeld
          label={m.plan_ende()}
          minute={props.werte.endeMinute}
          onMinute={(endeMinute) => props.setze({ endeMinute })}
        />
      </div>
      <p class="text-[12px] text-muted-foreground">{m.plan_ende_hinweis()}</p>
      <div class="grid grid-cols-2 gap-3">
        <ZahlFeld
          label={m.plan_pause()}
          wert={props.werte.pauseMinuten}
          min={0}
          max={1439}
          onWert={(pauseMinuten) => props.setze({ pauseMinuten })}
        />
        <TextFeld
          label={m.plan_rolle()}
          wert={props.werte.rolle}
          vorschlaege={props.rollen}
          onWert={(rolle) => props.setze({ rolle })}
        />
      </div>
    </>
  );
};

/**
 * Adding or changing a shift (S-501): from a template or by hand, a person or open; changing the day
 * or person moves the shift as dragging would. It stays a draft until it is published (S-503).
 */
export const SchichtDialog = (
  props: Omit<Felder, "werte" | "setze"> & {
    modus: SchichtModus;
    standortId: string;
    onSchliessen: () => void;
  },
) => {
  // the dialog opens for one shift or one cell; a new one opens for the next (dialoge.tsx)
  const modus = untrack(() => props.modus);
  const [offen, setOffen] = createSignal(true);
  // the form starts from the shift or cell and then belongs to the person's typing: read once, as a
  // field derived from the plan's data would be reset whenever the week loads again
  const [werte, setWerte] = createSignal(untrack(() => startwerte(modus, props.standortId)));
  const [fehler, setFehler] = createSignal("");
  const senden = schreiben(() => PLAN_AENDERT);
  /** Closes once the server took it and the week shows the change */
  const fertig = async (auftrag: () => Promise<Antwort<unknown>>) => {
    const ergebnis = await senden.mutate(auftrag);
    if (!ergebnis.ok) return setFehler((FEHLER[ergebnis.fehler] ?? (() => m.fehler_speichern()))());
    setOffen(false);
  };
  const absenden = (event: SubmitEvent) => {
    event.preventDefault();
    const eingabe = { ...werte(), rolle: werte().rolle.trim() };
    // a change keeps the template the shift was planned from; only a new shift names one
    const { vorlageId: _vorlage, ...geaendert } = eingabe;
    void fertig(() =>
      modus.art === "neu"
        ? schichtAnlegen(eingabe)
        : schichtAendern(modus.schicht.schichtId, geaendert),
    );
  };
  return (
    <Dialog
      offen={offen()}
      titel={modus.art === "neu" ? m.plan_hinzufuegen() : m.plan_bearbeiten()}
      onSchliessen={props.onSchliessen}
    >
      <form class="flex flex-col gap-3" onSubmit={absenden} novalidate>
        <SchichtFelder
          {...props}
          werte={werte()}
          setze={(teil) => setWerte((alt) => ({ ...alt, ...teil }))}
        />
        <Fehler text={fehler()} />
        <div class="flex flex-wrap justify-end gap-2">
          {modus.art === "bearbeiten" && (
            <Button
              variant="outline"
              class="me-auto text-danger"
              onClick={() => void fertig(() => schichtEntfernen(modus.schicht.schichtId))}
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

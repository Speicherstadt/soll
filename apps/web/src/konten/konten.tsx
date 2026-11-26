import type { JSX } from "@solidjs/web";
import { Button } from "@soll/ui";
import { createSignal, createUniqueId, For, Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { tageText, tagText } from "../abwesenheiten/text.ts";
import { feld } from "../einrichtung/stil.ts";
import { saldoText } from "../monat/zeilen.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import type { Person } from "../zeiten/typen.ts";
import { AnpassungDialog, HinweisDialog } from "./dialoge.tsx";
import { anpassungText, befundZeilen, hinweisText, lueckeText } from "./text.ts";
import type { Konten as KontenDaten } from "./typen.ts";

export const Wert = (props: { name: string; children: JSX.Element }) => (
  <div class="flex flex-col gap-0.5 rounded-xl border border-border p-3">
    <dt class="text-[12px] text-muted-foreground">{props.name}</dt>
    <dd class="font-semibold text-[17px] tabular-nums">{props.children}</dd>
  </div>
);

/** Leave left with its years and when each expires, and the overtime (R-23, S-208) */
const Stand = (props: { k: KontenDaten; zusatz?: JSX.Element }) => {
  const urlaub = () => props.k.urlaub;
  const zeilen = () => {
    const u = urlaub();
    if (!u.ok) return [];
    return befundZeilen(u.befunde ?? []);
  };
  return (
    <>
      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Wert name={m.konten_resturlaub()}>
          {(() => {
            const u = urlaub();
            if (!u.ok) return lueckeText(u);
            return u.geplantHalbtage > 0
              ? m.konten_rest_geplant({
                  rest: tageText(u.restHalbtage),
                  geplant: tageText(u.geplantHalbtage),
                })
              : tageText(u.restHalbtage);
          })()}
        </Wert>
        <Wert name={m.konten_ueberstunden()}>
          {(() => {
            const u = props.k.ueberstunden;
            return u.ok ? saldoText(u.saldoMinuten) : lueckeText(u);
          })()}
        </Wert>
        {props.zusatz}
      </dl>
      <Show when={zeilen().length > 0}>
        <ul class="flex flex-col gap-1">
          <For each={zeilen()}>
            {(zeile) => <li class={zeile.warnung ? "text-warning" : ""}>{zeile.text}</li>}
          </For>
        </ul>
      </Show>
      <Show when={props.k.ueberstunden.ok && props.k.ueberstunden.luecken.length > 0}>
        <p class="text-muted-foreground">
          {m.konten_luecken({
            monate: props.k.ueberstunden.ok ? props.k.ueberstunden.luecken.join(", ") : "",
          })}
        </p>
      </Show>
    </>
  );
};

/** The notices on leave expiring and the changes by hand, as the person sees them too */
const Verlauf = (props: { k: KontenDaten }) => (
  <>
    <Show when={props.k.hinweise.length > 0}>
      <h2 class="font-medium">{m.konten_hinweise_titel()}</h2>
      <ul class="flex flex-col gap-1">
        <For each={props.k.hinweise}>
          {(h) => (
            <li>
              {m.konten_hinweis_zeile({
                datum: tagText(h.tag, true),
                inhalt: hinweisText(h.inhalt),
              })}
            </li>
          )}
        </For>
      </ul>
    </Show>
    <Show when={props.k.anpassungen.length > 0}>
      <h2 class="font-medium">{m.konten_anpassungen_titel()}</h2>
      <ul class="flex flex-col gap-1">
        <For each={props.k.anpassungen}>{(a) => <li>{anpassungText(a)}</li>}</For>
      </ul>
    </Show>
  </>
);

/** The owner records the notice and changes the accounts by hand (konten:pflegen) */
const Pflege = (props: { k: KontenDaten; onMeldung: (text: string) => void }) => {
  const [dialog, setDialog] = createSignal<"hinweis" | "anpassung" | null>(null);
  return (
    <>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setDialog("hinweis")}>
          {m.konten_hinweis_geben()}
        </Button>
        <Button variant="outline" onClick={() => setDialog("anpassung")}>
          {m.konten_anpassen()}
        </Button>
      </div>
      <Show when={dialog() === "hinweis"}>
        <HinweisDialog
          k={props.k}
          onSchliessen={() => setDialog(null)}
          onGespeichert={() => props.onMeldung(m.konten_hinweis_gespeichert())}
        />
      </Show>
      <Show when={dialog() === "anpassung"}>
        <AnpassungDialog
          k={props.k}
          onSchliessen={() => setDialog(null)}
          onGespeichert={() => props.onMeldung(m.konten_anpassung_gespeichert())}
        />
      </Show>
    </>
  );
};

/** Whose accounts: the person, for whoever may see others' times */
const PersonWahl = (props: {
  personen: Person[];
  nutzerId: string | undefined;
  onPerson: (nutzerId: string) => void;
}) => {
  const id = createUniqueId();
  return (
    <div class="flex max-w-xs flex-col gap-1.5">
      <label for={id} class="font-medium">
        {m.konten_person()}
      </label>
      <select
        id={id}
        class={feld}
        value={props.nutzerId ?? ""}
        onChange={(event) => props.onPerson(event.currentTarget.value)}
      >
        <For each={props.personen}>
          {(person) => <option value={person.nutzerId}>{person.name}</option>}
        </For>
      </select>
    </div>
  );
};

/**
 * The accounts in the app (S-402): leave left with carry-over and expiry, overtime, the notices on
 * leave expiring and the changes by hand. Whoever sees all times picks a person; there is no list of
 * everyone's balances (BetrVG § 87 Abs. 1 Nr. 6).
 */
export const Konten = (props: {
  ich: string;
  personen: Person[];
  /** the counter of Kind krank, shown with one's own accounts */
  zusatz?: JSX.Element;
}) => {
  const [nutzerId, setNutzerId] = createSignal<string | undefined>(undefined);
  const [meldung, setMeldung] = createSignal("");
  const konten = abfrage<KontenDaten>(() => ressourcen.konten({ nutzerId: nutzerId() }));
  const k = () => daten(konten.data);
  const waehlen = (id: string) => {
    setMeldung("");
    setNutzerId(id === props.ich ? undefined : id);
  };
  return (
    <section aria-label={m.konten_titel()} class="flex flex-col gap-3">
      <Show when={props.personen.length > 0}>
        <PersonWahl
          personen={props.personen}
          nutzerId={nutzerId() ?? props.ich}
          onPerson={waehlen}
        />
      </Show>
      <Loading>
        <Fehler text={konten.data.ok ? "" : m.laden_fehler()} />
        <Show when={k()}>
          {(stand) => (
            <>
              <Stand
                k={stand()}
                zusatz={<Show when={stand().nutzerId === props.ich}>{props.zusatz}</Show>}
              />
              <Verlauf k={stand()} />
              <Show when={stand().rechte.pflegen}>
                <Pflege k={stand()} onMeldung={setMeldung} />
              </Show>
            </>
          )}
        </Show>
      </Loading>
      <Show when={meldung()}>
        <p role="status">{meldung()}</p>
      </Show>
    </section>
  );
};

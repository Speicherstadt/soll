import { ABWESENHEITSARTEN, type Abwesenheitsart } from "@soll/arbeitszeit";
import type { Ziel, Zuordnung } from "@soll/import";
import { createUniqueId, For, Show } from "solid-js";
import { ART } from "../abwesenheiten/text.ts";
import { m } from "../paraglide/messages.js";
import { Abschnitt, type Option, Zeile } from "./auswahl.tsx";
import { type BuchungAendern, BuchungZuordnung } from "./buchung.tsx";
import { FELD_NAMEN } from "./texte.ts";
import type { Vorschau } from "./typen.ts";

/* Step 3: what each column, person, kind, customer and order of the file becomes in Soll (S-701) */

const NICHT = "";

const zielWert = (ziel: Ziel | undefined): string =>
  ziel === undefined || ziel === "neu" ? "neu" : ziel === "aus" ? "aus" : `id:${ziel.id}`;
const zielAus = (wert: string): Ziel =>
  wert === "neu" || wert === "aus" ? wert : { id: wert.slice(3) };

const zielOptionen = (vorhanden: { id: string; name: string }[]): Option[] => [
  { wert: "neu", name: m.umzug_neu_anlegen() },
  { wert: "aus", name: m.umzug_nicht_uebernehmen() },
  ...vorhanden.map(({ id, name }) => ({ wert: `id:${id}`, name })),
];

export type Aendern = BuchungAendern & {
  spalte: (feld: string, kopf: string | null) => void;
  person: (person: string, nutzerId: string | null) => void;
  art: (art: string, ziel: Abwesenheitsart | null) => void;
  kunde: (externalId: string, ziel: Ziel) => void;
  projekt: (externalId: string, ziel: Ziel) => void;
};

const Spalten = (props: {
  vorschau: Vorschau;
  spalten: Record<string, string | null>;
  aendern: Aendern;
}) => (
  <Abschnitt titel={m.umzug_spalten_titel()} text={m.umzug_spalten_text()}>
    <For each={props.vorschau.felder}>
      {(feldName) => (
        <Zeile
          name={FELD_NAMEN[feldName]?.() ?? feldName}
          wert={props.spalten[feldName] ?? NICHT}
          optionen={[
            { wert: NICHT, name: m.umzug_spalte_keine() },
            ...props.vorschau.kopf.map((kopf) => ({ wert: kopf, name: kopf })),
          ]}
          aendern={(wert) => props.aendern.spalte(feldName, wert === NICHT ? null : wert)}
        />
      )}
    </For>
  </Abschnitt>
);

const Personen = (props: { vorschau: Vorschau; zuordnung: Zuordnung; aendern: Aendern }) => (
  <Abschnitt titel={m.umzug_personen_titel()} text={m.umzug_personen_text()}>
    <For each={props.vorschau.personen}>
      {(p) => (
        <Zeile
          name={p.person}
          hinweis={m.umzug_datensaetze({ anzahl: p.datensaetze })}
          wert={props.zuordnung.personen[p.person] ?? NICHT}
          optionen={[
            { wert: NICHT, name: m.umzug_nicht_uebernehmen() },
            ...props.vorschau.mitglieder.map((g) => ({ wert: g.nutzerId, name: g.name })),
          ]}
          aendern={(wert) => props.aendern.person(p.person, wert === NICHT ? null : wert)}
        />
      )}
    </For>
  </Abschnitt>
);

const Arten = (props: { vorschau: Vorschau; zuordnung: Zuordnung; aendern: Aendern }) => (
  <Abschnitt titel={m.umzug_arten_titel()}>
    <For each={props.vorschau.arten}>
      {(a) => (
        <Zeile
          name={a.art}
          hinweis={m.umzug_datensaetze({ anzahl: a.datensaetze })}
          wert={props.zuordnung.arten[a.art] ?? NICHT}
          optionen={[
            { wert: NICHT, name: m.umzug_nicht_uebernehmen() },
            ...ABWESENHEITSARTEN.map((art) => ({ wert: art, name: ART[art]() })),
          ]}
          aendern={(wert) =>
            props.aendern.art(a.art, wert === NICHT ? null : (wert as Abwesenheitsart))
          }
        />
      )}
    </For>
  </Abschnitt>
);

const Projektzeit = (props: { vorschau: Vorschau; zuordnung: Zuordnung; aendern: Aendern }) => {
  const kunden = () =>
    props.vorschau.vorhandeneKunden.map((k) => ({ id: k.kundeId, name: k.name }));
  const projekte = () =>
    props.vorschau.vorhandeneProjekte.map((p) => ({ id: p.projektId, name: p.name }));
  return (
    <>
      <Show when={props.vorschau.kunden.length > 0}>
        <Abschnitt titel={m.umzug_kunden_titel()}>
          <For each={props.vorschau.kunden}>
            {(k) => (
              <Zeile
                name={k.name}
                hinweis={k.nummer}
                wert={zielWert(props.zuordnung.kunden[k.externalId])}
                optionen={zielOptionen(kunden())}
                aendern={(wert) => props.aendern.kunde(k.externalId, zielAus(wert))}
              />
            )}
          </For>
        </Abschnitt>
      </Show>
      <Show when={props.vorschau.projekte.length > 0}>
        <Abschnitt titel={m.umzug_projekte_titel()}>
          <For each={props.vorschau.projekte}>
            {(p) => (
              <Zeile
                name={p.name}
                hinweis={p.nummer}
                wert={zielWert(props.zuordnung.projekte[p.externalId])}
                optionen={zielOptionen(projekte())}
                aendern={(wert) => props.aendern.projekt(p.externalId, zielAus(wert))}
              />
            )}
          </For>
        </Abschnitt>
      </Show>
    </>
  );
};

/** Whether the old tool had closed months, and up to which */
const Abgeschlossen = (props: {
  bis: string | null;
  hoechstens: string;
  setzen: (bis: string | null) => void;
}) => {
  const id = createUniqueId();
  return (
    <Abschnitt titel={m.umzug_abgeschlossen_titel()} text={m.umzug_abgeschlossen_text()}>
      <label class="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={props.bis !== null}
          onChange={(event) => props.setzen(event.currentTarget.checked ? props.hoechstens : null)}
        />
        {m.umzug_abgeschlossen_an()}
      </label>
      <Show when={props.bis}>
        {(bis) => (
          <div class="flex flex-col gap-1.5">
            <label for={id} class="font-medium">
              {m.umzug_abgeschlossen_bis()}
            </label>
            <input
              id={id}
              type="month"
              class="h-9 w-48 rounded-md border border-border bg-background px-2"
              max={props.hoechstens}
              value={bis()}
              onChange={(event) => props.setzen(event.currentTarget.value || null)}
            />
          </div>
        )}
      </Show>
    </Abschnitt>
  );
};

export const ZuordnungSchritt = (props: {
  vorschau: Vorschau;
  spalten: Record<string, string | null>;
  zuordnung: Zuordnung;
  aendern: Aendern;
  abgeschlossenBis: string | null;
  hoechstens: string;
  setzeAbgeschlossenBis: (bis: string | null) => void;
}) => (
  <div class="flex flex-col gap-6">
    <Show when={!props.vorschau.module.arbeitszeit || !props.vorschau.module.projektzeit}>
      <p class="rounded-lg bg-warning-surface px-3 py-2.5">{m.umzug_module_aus()}</p>
    </Show>
    <Spalten vorschau={props.vorschau} spalten={props.spalten} aendern={props.aendern} />
    <Show when={props.vorschau.personen.length > 0}>
      <Personen vorschau={props.vorschau} zuordnung={props.zuordnung} aendern={props.aendern} />
    </Show>
    <Show when={props.vorschau.arten.length > 0}>
      <Arten vorschau={props.vorschau} zuordnung={props.zuordnung} aendern={props.aendern} />
    </Show>
    <Projektzeit vorschau={props.vorschau} zuordnung={props.zuordnung} aendern={props.aendern} />
    <BuchungZuordnung
      vorschau={props.vorschau}
      zuordnung={props.zuordnung}
      aendern={props.aendern}
    />
    <Abgeschlossen
      bis={props.abgeschlossenBis}
      hoechstens={props.hoechstens}
      setzen={props.setzeAbgeschlossenBis}
    />
  </div>
);

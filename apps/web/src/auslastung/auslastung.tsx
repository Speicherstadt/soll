import { type Monat, plusMonate, tagInBerlin } from "@soll/arbeitszeit";
import { createSignal, createUniqueId, Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { Auswahl } from "../monat/auswahl.tsx";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { AuslastungWerte } from "./balken.tsx";
import { PersonenTabelle } from "./personen.tsx";
import { JePersonSchalter } from "./schalter.tsx";
import type { IchAntwort, PersonenAntwort, TeamAntwort } from "./typen.ts";
import { teamZustand } from "./zustand.ts";

/** Owner and planner see the team and the people (rollen.ts on the server checks it again) */
export const verwaltet = () =>
  (aktuellerBetrieb()?.rolle ?? "")
    .split(",")
    .some((rolle) => ["inhaber", "planer"].includes(rolle.trim()));

export const jePersonAn = () => (aktuellerBetrieb()?.auswertungJePersonSeit ?? null) !== null;

/** The team's month: the numbers, or why there are none (too few people, a running month) */
const Team = (props: { monat: Monat }) => {
  const team = abfrage<TeamAntwort>(() => ressourcen.auslastung(props.monat));
  const zustand = () => teamZustand(team.data);
  const werte = () => {
    const z = zustand();
    return z.art === "werte" ? z.werte : null;
  };
  const mindestens = () => {
    const z = zustand();
    return z.art === "zu_klein" ? z.mindestens : null;
  };
  return (
    <>
      <Show when={werte()}>{(w) => <AuslastungWerte werte={w()} />}</Show>
      <Show when={mindestens()}>
        {(anzahl) => (
          <p class="text-muted-foreground">
            {m.auslastung_zu_klein({ mindestens: String(anzahl()) })}
          </p>
        )}
      </Show>
      <Show when={zustand().art === "monat_laeuft"}>
        <p class="text-muted-foreground">{m.auslastung_monat_laeuft()}</p>
      </Show>
      <Fehler text={zustand().art === "fehler" ? m.laden_fehler() : ""} />
    </>
  );
};

/** Every person of the month, while the business has switched it on */
const Personen = (props: { monat: Monat }) => {
  const personen = abfrage<PersonenAntwort>(() => ressourcen.auslastungPersonen(props.monat));
  return (
    <>
      <PersonenTabelle personen={daten(personen.data)?.personen ?? []} />
      <Fehler text={personen.data.ok ? "" : m.laden_fehler()} />
    </>
  );
};

/** One's own month, while the business has switched the view per person on */
const Eigene = (props: { monat: Monat }) => {
  const ich = abfrage<IchAntwort>(() => ressourcen.auslastungIch(props.monat));
  return (
    <>
      <Show when={daten(ich.data)?.eigene}>{(eigene) => <AuslastungWerte werte={eigene()} />}</Show>
      <Fehler text={ich.data.ok ? "" : m.laden_fehler()} />
    </>
  );
};

/**
 * The utilisation of a month (S-604) on Auswertungen: for owner and planner the team, the switch
 * of the view per person and, while it is on, every person; for everyone else, while it is on,
 * their own month. The month before this one first: the team view only shows months that ended.
 */
export const AuslastungBereich = () => {
  const id = createUniqueId();
  const [monat, setMonat] = createSignal<Monat>(
    plusMonate(tagInBerlin(Date.now()).slice(0, 7), -1),
  );
  return (
    <section aria-labelledby={`${id}-titel`} class="flex max-w-3xl flex-col gap-4">
      <h2 id={`${id}-titel`} class="font-semibold">
        {m.auslastung_titel()}
      </h2>
      <p class="text-muted-foreground">
        {verwaltet() ? m.auslastung_text_team() : m.auslastung_text_eigene()}
      </p>
      <Auswahl
        personen={[]}
        nutzerId={undefined}
        monat={monat()}
        onPerson={() => undefined}
        onMonat={setMonat}
      />
      <Loading>
        <Show when={verwaltet()} fallback={<Eigene monat={monat()} />}>
          <h3 class="font-medium">{m.auslastung_team()}</h3>
          <Team monat={monat()} />
          <JePersonSchalter />
          <Show when={jePersonAn()}>
            <h3 class="font-medium">{m.auslastung_personen()}</h3>
            <Personen monat={monat()} />
          </Show>
        </Show>
      </Loading>
    </section>
  );
};

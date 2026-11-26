import { createFileRoute } from "@tanstack/solid-router";
import { Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { Antrag } from "../abwesenheiten/antrag.tsx";
import { Kinderkrank } from "../abwesenheiten/kinderkrank.tsx";
import { Krank } from "../abwesenheiten/krank.tsx";
import { MeineListe } from "../abwesenheiten/liste.tsx";
import { Offen } from "../abwesenheiten/offen.tsx";
import { abwesenheitQuelle } from "../abwesenheiten/quelle.ts";
import { Team } from "../abwesenheiten/team.tsx";
import { Konten } from "../konten/konten.tsx";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Seite } from "../rahmen/seite.tsx";
import type { Person } from "../zeiten/typen.ts";

/**
 * Abwesenheiten (S-401, S-402): the accounts, a request, a sickness report, one's own absences, the
 * requests waiting for a decision and the team calendar (design/mockup/Abwesenheit.dc.html)
 */
const Abwesenheiten = () => {
  const q = abwesenheitQuelle();
  // whoever sees all times picks whose accounts; for everyone else the answer is a refusal
  const personen = abfrage<{ personen: Person[] }>(ressourcen.personen);
  /** one's own absences as loaded; the first load suspends to the Loading below */
  const liste = () => daten(q.liste.data);
  return (
    <Seite titel={m.nav_abwesenheiten()}>
      <Fehler text={q.fehler()} />
      <Show when={q.meldung()}>
        <p role="status">{q.meldung()}</p>
      </Show>
      <Loading>
        <Fehler text={q.liste.data.ok ? "" : m.laden_fehler()} />
        <Show when={liste()}>
          {(l) => (
            <>
              <Konten
                ich={l().nutzerId}
                personen={daten(personen.data)?.personen ?? []}
                zusatz={<Kinderkrank jahr={l().jahr} stand={l().kinderkrank} />}
              />
              <Offen quelle={q} rechte={l().rechte} />
              <div class="grid gap-5 lg:grid-cols-12 lg:items-start">
                <div class="flex flex-col gap-5 lg:col-span-7">
                  <Team heute={l().heute} onGespeichert={q.geschafft} />
                  <MeineListe quelle={q} abwesenheiten={l().abwesenheiten} />
                </div>
                <div class="flex flex-col gap-5 lg:col-span-5">
                  <Antrag quelle={q} heute={l().heute} />
                  <Krank
                    quelle={q}
                    abwesenheiten={l().abwesenheiten}
                    heute={l().heute}
                    abTag={l().bescheinigungAbTag}
                  />
                </div>
              </div>
            </>
          )}
        </Show>
      </Loading>
    </Seite>
  );
};

export const Route = createFileRoute("/abwesenheiten")({ component: Abwesenheiten });

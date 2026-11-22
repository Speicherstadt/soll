import { createFileRoute } from "@tanstack/solid-router";
import { Loading, Show } from "solid-js";
import { daten } from "../abfragen/abfrage.ts";
import { Antrag } from "../abwesenheiten/antrag.tsx";
import { Konten } from "../abwesenheiten/konten.tsx";
import { Krank } from "../abwesenheiten/krank.tsx";
import { MeineListe } from "../abwesenheiten/liste.tsx";
import { Offen } from "../abwesenheiten/offen.tsx";
import { abwesenheitQuelle } from "../abwesenheiten/quelle.ts";
import { Team } from "../abwesenheiten/team.tsx";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Seite } from "../rahmen/seite.tsx";

/**
 * Abwesenheiten (S-401): leave left, a request, a sickness report, one's own absences, the requests
 * waiting for a decision and the team (design/mockup/Abwesenheit.dc.html)
 */
const Abwesenheiten = () => {
  const q = abwesenheitQuelle();
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
              <Konten liste={l()} />
              <Offen quelle={q} rechte={l().rechte} />
              <div class="grid gap-5 lg:grid-cols-2">
                <div class="flex flex-col gap-5">
                  <Antrag quelle={q} heute={l().heute} />
                  <MeineListe quelle={q} abwesenheiten={l().abwesenheiten} />
                </div>
                <div class="flex flex-col gap-5">
                  <Krank
                    quelle={q}
                    abwesenheiten={l().abwesenheiten}
                    heute={l().heute}
                    abTag={l().bescheinigungAbTag}
                  />
                  <Team heute={l().heute} />
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

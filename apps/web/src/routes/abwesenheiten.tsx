import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
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
  return (
    <Seite titel={m.nav_abwesenheiten()}>
      <Fehler text={q.fehler()} />
      <Show when={q.meldung()}>
        <p role="status">{q.meldung()}</p>
      </Show>
      <Show when={q.liste()}>
        {(liste) => (
          <>
            <Konten liste={liste()} />
            <Offen quelle={q} />
            <div class="grid gap-5 lg:grid-cols-2">
              <div class="flex flex-col gap-5">
                <Antrag quelle={q} heute={liste().heute} />
                <MeineListe quelle={q} />
              </div>
              <div class="flex flex-col gap-5">
                <Krank quelle={q} heute={liste().heute} abTag={liste().bescheinigungAbTag} />
                <Team quelle={q} />
              </div>
            </div>
          </>
        )}
      </Show>
    </Seite>
  );
};

export const Route = createFileRoute("/abwesenheiten")({ component: Abwesenheiten });

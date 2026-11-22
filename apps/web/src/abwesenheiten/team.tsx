import { Button } from "@soll/ui";
import { createSignal, For, Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Karte } from "./karte.tsx";
import { GrundFuer } from "./offen.tsx";
import { teamZeitraum } from "./quelle.ts";
import { ART, zeitraumText } from "./text.ts";
import type { Abwesenheit, TeamEintrag } from "./typen.ts";

const alsAbwesenheit = (e: TeamEintrag): Abwesenheit & { name: string } => ({
  ...e,
  status: "genehmigt",
  kind: null,
  bescheinigung: null,
  grund: null,
});

/**
 * Who is away in the next four weeks: every absence only as „abwesend“, for everyone (Art. 9 DSGVO);
 * owner and planner cancel approved leave here, with a reason
 */
export const Team = (props: { heute: string; onGespeichert: () => void }) => {
  const [storno, setStorno] = createSignal<TeamEintrag | null>(null);
  const team = abfrage<{ abwesenheiten: TeamEintrag[] }>(() =>
    ressourcen.abwesenheitenTeam(teamZeitraum(props.heute)),
  );
  const eintraege = () => daten(team.data)?.abwesenheiten ?? [];
  return (
    <Karte titel={m.abw_team_titel()}>
      <Loading>
        <Fehler text={team.data.ok ? "" : m.laden_fehler()} />
        <Show
          when={eintraege().length > 0}
          fallback={<p class="text-muted-foreground">{m.abw_team_keine()}</p>}
        >
          <ul class="flex flex-col">
            <For each={eintraege()}>
              {(e) => (
                <li class="flex flex-wrap items-center justify-between gap-2 border-border border-t py-2 first:border-t-0">
                  <span>
                    <span class="font-medium">{e.name}</span> · {ART[e.art]()} · {zeitraumText(e)}
                  </span>
                  <Show when={e.stornierbar === true}>
                    <Button variant="outline" onClick={() => setStorno(e)}>
                      {m.abw_stornieren()}
                    </Button>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Loading>
      <Show when={storno()}>
        {(e) => (
          <GrundFuer
            a={alsAbwesenheit(e())}
            aktion="stornieren"
            onGespeichert={props.onGespeichert}
            onSchliessen={() => setStorno(null)}
          />
        )}
      </Show>
    </Karte>
  );
};

import { Button } from "@soll/ui";
import { createSignal, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Karte } from "./karte.tsx";
import { GrundFuer } from "./offen.tsx";
import type { AbwesenheitQuelle } from "./quelle.ts";
import { ART, zeitraumText } from "./text.ts";
import type { Abwesenheit, TeamEintrag } from "./typen.ts";

const STORNIERBAR = new Set(["urlaub", "sonderurlaub", "ueberstundenabbau"]);

const alsAbwesenheit = (e: TeamEintrag): Abwesenheit & { name: string } => ({
  ...e,
  status: "genehmigt",
  kind: null,
  bescheinigung: null,
  grund: null,
});

/**
 * Who is away in the next four weeks: sickness only as „abwesend“, for everyone (Art. 9 DSGVO);
 * owner and planner cancel approved leave here, with a reason
 */
export const Team = (props: { quelle: AbwesenheitQuelle }) => {
  const [storno, setStorno] = createSignal<TeamEintrag | null>(null);
  return (
    <Karte titel={m.abw_team_titel()}>
      <Show
        when={props.quelle.team().length > 0}
        fallback={<p class="text-muted-foreground">{m.abw_team_keine()}</p>}
      >
        <ul class="flex flex-col">
          <For each={props.quelle.team()}>
            {(e) => (
              <li class="flex flex-wrap items-center justify-between gap-2 border-border border-t py-2 first:border-t-0">
                <span>
                  <span class="font-medium">{e.name}</span> · {ART[e.art]()} ·{" "}
                  {e.offen
                    ? m.abw_ab({ von: zeitraumText({ von: e.von, bis: e.von }) })
                    : zeitraumText(e)}
                </span>
                <Show when={props.quelle.liste()?.rechte.freigeben && STORNIERBAR.has(e.art)}>
                  <Button variant="outline" onClick={() => setStorno(e)}>
                    {m.abw_stornieren()}
                  </Button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={storno()}>
        {(e) => (
          <GrundFuer
            a={alsAbwesenheit(e())}
            aktion="stornieren"
            quelle={props.quelle}
            onSchliessen={() => setStorno(null)}
          />
        )}
      </Show>
    </Karte>
  );
};

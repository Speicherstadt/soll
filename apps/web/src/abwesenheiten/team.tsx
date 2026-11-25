import type { Tag } from "@soll/arbeitszeit";
import { Button, Icon } from "@soll/ui";
import { ChevronLeft, ChevronRight } from "lucide";
import { createSignal, createUniqueId, For, Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Raster } from "./kalenderRaster.tsx";
import { Karte } from "./karte.tsx";
import { GrundFuer } from "./offen.tsx";
import { teamZeitraum } from "./quelle.ts";
import { ART, tagText, zeitraumText } from "./text.ts";
import type { Abwesenheit, Team as TeamDaten, TeamEintrag } from "./typen.ts";

type Standort = { standortId: string; name: string };

const alsAbwesenheit = (e: TeamEintrag): Abwesenheit & { name: string } => ({
  ...e,
  status: "genehmigt",
  kind: null,
  bescheinigung: null,
  grund: null,
});

/** Four weeks back and forth from the first day shown */
const verschoben = (von: Tag, wochen: number): Tag =>
  new Date(Date.parse(`${von}T12:00:00Z`) + wochen * 7 * 86_400_000).toISOString().slice(0, 10);

/** The site whose holidays the calendar shows, where the business has more than one */
const StandortWahl = (props: {
  standorte: Standort[];
  standortId: string | undefined;
  onWahl: (standortId: string) => void;
}) => {
  const id = createUniqueId();
  return (
    <div class="flex min-w-48 flex-col gap-1.5">
      <label for={id} class="font-medium">
        {m.abw_team_standort()}
      </label>
      <select
        id={id}
        class={feld}
        value={props.standortId ?? ""}
        onChange={(event) => props.onWahl(event.currentTarget.value)}
      >
        <For each={props.standorte}>{(s) => <option value={s.standortId}>{s.name}</option>}</For>
      </select>
    </div>
  );
};

/** The span shown, four weeks back and forth */
const Zeitraum = (props: { von: Tag; bis: Tag; onVon: (von: Tag) => void }) => (
  <div class="flex items-center gap-1">
    <Button
      variant="icon"
      aria-label={m.abw_team_zurueck()}
      onClick={() => props.onVon(verschoben(props.von, -4))}
    >
      <Icon icon={ChevronLeft} class="rtl:rotate-180" />
    </Button>
    <span class="min-w-36 text-center font-medium" aria-live="polite">
      {m.abw_zeitraum({ von: tagText(props.von), bis: tagText(props.bis) })}
    </span>
    <Button
      variant="icon"
      aria-label={m.abw_team_vor()}
      onClick={() => props.onVon(verschoben(props.von, 4))}
    >
      <Icon icon={ChevronRight} class="rtl:rotate-180" />
    </Button>
  </div>
);

/** Who is away, as a list; owner and planner cancel approved leave here, with a reason */
const Liste = (props: { eintraege: TeamEintrag[]; onStorno: (e: TeamEintrag) => void }) => (
  <Show
    when={props.eintraege.length > 0}
    fallback={<p class="text-muted-foreground">{m.abw_team_keine()}</p>}
  >
    <ul class="flex flex-col">
      <For each={props.eintraege}>
        {(e) => (
          <li class="flex flex-wrap items-center justify-between gap-2 border-border border-t py-2 first:border-t-0">
            <span>
              <span class="font-medium">{e.name}</span> · {ART[e.art]()} · {zeitraumText(e)}
            </span>
            <Show when={e.stornierbar === true}>
              <Button variant="outline" onClick={() => props.onStorno(e)}>
                {m.abw_stornieren()}
              </Button>
            </Show>
          </li>
        )}
      </For>
    </ul>
  </Show>
);

/** The calendar of the chosen site, from today four weeks on, back and forth */
const Kalender = (props: {
  heute: string;
  standorte: Standort[];
  onStorno: (e: TeamEintrag) => void;
}) => {
  const [von, setVon] = createSignal<Tag | undefined>(undefined);
  const [gewaehlt, setGewaehlt] = createSignal<string | undefined>(undefined);
  const standortId = () => gewaehlt() ?? props.standorte[0]?.standortId;
  const zeitraum = () => teamZeitraum(von() ?? props.heute);
  const team = abfrage<TeamDaten>(() =>
    ressourcen.abwesenheitenTeam({ ...zeitraum(), standortId: standortId() }),
  );
  const stand = () => daten(team.data);
  return (
    <>
      <div class="flex flex-wrap items-end gap-3">
        <Show when={props.standorte.length > 1}>
          <StandortWahl
            standorte={props.standorte}
            standortId={standortId()}
            onWahl={setGewaehlt}
          />
        </Show>
        <Zeitraum von={zeitraum().von} bis={zeitraum().bis} onVon={setVon} />
      </div>
      <Loading>
        <Fehler text={team.data.ok ? "" : m.laden_fehler()} />
        <Show when={stand()}>
          {(t) => (
            <>
              <div class="hidden md:block">
                <Raster team={t()} />
              </div>
              <Show when={t().feiertage.length > 0}>
                <p>
                  {m.abw_team_feiertage({
                    feiertage: t()
                      .feiertage.map((f) => `${tagText(f.tag)} ${f.name}`)
                      .join(" · "),
                  })}
                </p>
              </Show>
              <Liste eintraege={t().abwesenheiten} onStorno={props.onStorno} />
            </>
          )}
        </Show>
      </Loading>
    </>
  );
};

/**
 * The team calendar of a site (S-402): its holidays and who is away, every absence only as
 * „abwesend“, for everyone (Art. 9 DSGVO); no count per person (BetrVG § 87 Abs. 1 Nr. 6). A grid
 * from `md`, a list always (with cancelling for owner and planner).
 */
export const Team = (props: { heute: string; onGespeichert: () => void }) => {
  const [storno, setStorno] = createSignal<TeamEintrag | null>(null);
  const standorte = abfrage<{ standorte: Standort[] }>(ressourcen.standorte);
  return (
    <Karte titel={m.abw_team_titel()}>
      <Loading>
        {/* the sites first: the calendar asks for the first one's holidays */}
        <Show when={standorte.data}>
          {(antwort) => (
            <Kalender
              heute={props.heute}
              standorte={daten(antwort())?.standorte ?? []}
              onStorno={setStorno}
            />
          )}
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

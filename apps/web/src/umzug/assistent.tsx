import { quelleVon } from "@soll/import";
import { Button } from "@soll/ui";
import { Match, Show, Switch } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Schrittfolge } from "../rahmen/schritte.tsx";
import { type Ablauf, umzugAblauf } from "./ablauf.ts";
import { DateiSchritt } from "./datei.tsx";
import { SCHRITT_NAMEN } from "./texte.ts";
import { UebernahmeSchritt } from "./uebernahme.tsx";
import { VorschauSchritt } from "./vorschau.tsx";
import { WerkzeugSchritt } from "./werkzeug.tsx";
import { ZuordnungSchritt } from "./zuordnung.tsx";
import { SCHRITTE } from "./zustand.ts";

/** Back and on; on only once the step has what the next one needs (a file read) */
const Fuss = (props: { ablauf: Ablauf }) => {
  const letzter = () => props.ablauf.schritt() === SCHRITTE.length - 1;
  const gesperrt = () =>
    props.ablauf.arbeitet() || (props.ablauf.schritt() >= 1 && props.ablauf.vorschau() === null);
  return (
    <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
      <span class="text-muted-foreground">
        {m.einrichtung_stand({ nummer: props.ablauf.schritt() + 1, anzahl: SCHRITTE.length })}
      </span>
      <div class="flex gap-2">
        <Show when={props.ablauf.schritt() > 0 && props.ablauf.uebernahme() === null}>
          <Button
            variant="outline"
            size="lg"
            disabled={props.ablauf.arbeitet()}
            onClick={() => props.ablauf.setSchritt((s) => s - 1)}
          >
            {m.einrichtung_zurueck()}
          </Button>
        </Show>
        <Show when={!letzter()}>
          <Button
            size="lg"
            disabled={gesperrt()}
            onClick={() => props.ablauf.setSchritt((s) => s + 1)}
          >
            {m.einrichtung_weiter()}
          </Button>
        </Show>
      </div>
    </div>
  );
};

/** The step on show, by its number */
const Schritt = (props: { ablauf: Ablauf }) => {
  const a = props.ablauf;
  return (
    <Switch>
      <Match when={a.schritt() === 0}>
        <WerkzeugSchritt quelle={a.quelle()} waehlen={a.setQuelle} />
      </Match>
      <Match when={a.schritt() === 1}>
        <DateiSchritt
          vorschau={a.vorschau()}
          wege={quelleVon(a.quelle())?.wege ?? ["datei"]}
          weg={a.weg()}
          setWeg={a.setWeg}
          arbeitet={a.arbeitet()}
          gewaehlt={(datei) => void a.dateiGewaehlt(datei)}
          abrufen={a.abrufen}
          zuGross={() => a.setFehler(m.umzug_fehler_zu_gross())}
        />
      </Match>
      <Match when={a.schritt() === 2 && a.vorschau()}>
        {(vorschau) => (
          <ZuordnungSchritt
            vorschau={vorschau()}
            spalten={a.spalten()}
            zuordnung={a.zuordnung}
            aendern={a.aendern}
            abgeschlossenBis={a.bis()}
            hoechstens={a.hoechstens()}
            setzeAbgeschlossenBis={a.setBis}
          />
        )}
      </Match>
      <Match when={a.schritt() === 3 && a.vorschau()}>
        {(vorschau) => <VorschauSchritt vorschau={vorschau()} />}
      </Match>
      <Match when={a.schritt() === 4}>
        <UebernahmeSchritt
          probelauf={a.probelauf()}
          uebernahme={a.uebernahme()}
          arbeitet={a.arbeitet()}
          probieren={() => void a.probieren()}
          uebernehmen={() => void a.uebernehmen()}
          neu={a.neu}
        />
      </Match>
    </Switch>
  );
};

/**
 * The move from another tool (S-701), steps as pills like the setup (DESIGN.md, "Umzug"): tool and
 * export, file, mapping, preview with findings, dry run and takeover
 */
export const Assistent = () => {
  const ablauf = umzugAblauf();
  return (
    <div class="flex max-w-[880px] flex-col gap-5">
      <p class="text-muted-foreground">{m.umzug_text()}</p>
      <Schrittfolge
        namen={SCHRITTE.map((schritt) => SCHRITT_NAMEN[schritt]())}
        aktuell={ablauf.schritt()}
        beschriftung={m.umzug_schritte()}
      />
      <section
        aria-labelledby="umzug-schritt"
        class="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-background p-4 md:p-6"
      >
        <h2 id="umzug-schritt" class="font-semibold text-[17px]">
          {SCHRITT_NAMEN[SCHRITTE[ablauf.schritt()] ?? "werkzeug"]()}
        </h2>
        <Schritt ablauf={ablauf} />
        <Fehler text={ablauf.fehler()} />
        <Fuss ablauf={ablauf} />
      </section>
    </div>
  );
};

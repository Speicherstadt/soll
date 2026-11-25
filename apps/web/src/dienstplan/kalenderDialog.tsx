import { Button, Dialog, Icon } from "@soll/ui";
import { CalendarPlus, Copy } from "lucide";
import { createSignal, Loading, Show } from "solid-js";
import { abfrage, daten, schreiben } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { Fehler } from "../rahmen/karte.tsx";
import { datumText, webcalVon } from "./text.ts";
import type { KalenderAbo } from "./typen.ts";

type Ausgestellt = { abo: KalenderAbo; url: string };

/** The link of the feed, shown once after issuing it: copy it or open it in the calendar app */
const NeuerLink = (props: { url: string }) => {
  const [kopiert, setKopiert] = createSignal(false);
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(props.url);
      setKopiert(true);
    } catch {
      // no clipboard (an insecure origin): the link stays selectable in its field
    }
  };
  return (
    <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
      <p role="status">{m.plan_kalender_einmal()}</p>
      <div class="flex items-center gap-2">
        <input
          readonly
          aria-label={m.plan_kalender_link()}
          value={props.url}
          dir="ltr"
          class="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-mono text-[12px]"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button variant="icon" aria-label={m.plan_kalender_kopieren()} onClick={kopieren}>
          <Icon icon={Copy} />
        </Button>
      </div>
      <Show when={kopiert()}>
        <span class="text-[12px] text-success">{m.zugang_kopiert()}</span>
      </Show>
      <a
        href={webcalVon(props.url)}
        class="inline-flex items-center gap-2 self-start font-medium text-[13px] underline underline-offset-4"
      >
        <Icon icon={CalendarPlus} />
        {m.plan_kalender_oeffnen()}
      </a>
    </div>
  );
};

/**
 * The own shifts as a calendar (S-503): issue a secret link, issue it again (the old one stops) or
 * revoke it. The link leaves the server only in the answer to issuing it, so it shows this once.
 */
export const KalenderDialog = (props: { onSchliessen: () => void }) => {
  const [offen, setOffen] = createSignal(true);
  const [neu, setNeu] = createSignal<Ausgestellt | null>(null);
  const [fehler, setFehler] = createSignal("");
  const stand = abfrage<{ abo: KalenderAbo | null }>(() => ressourcen.kalender());
  const aendern = schreiben(() => [alle(PFAD.kalender)]);
  const ausstellen = async () => {
    const antwort = await aendern.mutate(() =>
      api<Ausgestellt>("/api/v1/dienstplan/kalender", { body: { sprache: getLocale() } }),
    );
    setFehler(antwort.ok ? "" : m.fehler_speichern());
    setNeu(antwort.ok ? (antwort.daten as Ausgestellt) : null);
  };
  const widerrufen = async () => {
    const antwort = await aendern.mutate(() =>
      api("/api/v1/dienstplan/kalender", { method: "DELETE" }),
    );
    setFehler(antwort.ok ? "" : m.fehler_speichern());
    if (antwort.ok) setNeu(null);
  };
  const abo = () => daten(stand.data)?.abo ?? null;
  return (
    <Dialog offen={offen()} titel={m.plan_kalender_titel()} onSchliessen={props.onSchliessen}>
      <div class="flex flex-col gap-4">
        <p>{m.plan_kalender_text()}</p>
        <Show when={neu()}>{(ausgestellt) => <NeuerLink url={ausgestellt().url} />}</Show>
        <Loading>
          <Show when={abo()}>
            {(vorhanden) => (
              <p class="text-muted-foreground">
                {m.plan_kalender_aktiv({ datum: datumText(vorhanden().angelegtAm) })}{" "}
                {m.plan_kalender_neu_hinweis()}
              </p>
            )}
          </Show>
          <Fehler text={fehler()} />
          <div class="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOffen(false)}>
              {m.plan_schliessen()}
            </Button>
            <Show when={abo()}>
              <Button variant="outline" class="text-danger" onClick={() => void widerrufen()}>
                {m.plan_kalender_widerrufen()}
              </Button>
            </Show>
            <Button onClick={() => void ausstellen()}>
              {abo() ? m.plan_kalender_neu() : m.plan_kalender_erstellen()}
            </Button>
          </div>
        </Loading>
      </div>
    </Dialog>
  );
};

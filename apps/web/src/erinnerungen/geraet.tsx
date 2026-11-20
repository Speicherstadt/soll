import { Button } from "@soll/ui";
import { createSignal, Show } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { Fehler } from "../rahmen/karte.tsx";
import { ausschalten, browserUmgebung, einschalten, type Stand, standLesen } from "./push.ts";

const FEHLER = {
  nicht_verfuegbar: m.erinnerungen_geraet_nicht_verfuegbar,
  abgelehnt: m.erinnerungen_geraet_abgelehnt,
  server: m.fehler_speichern,
} as const;

/** Notifications on this device: on or off, with the browser's permission (S-307) */
export const GeraetSchalter = (props: { vapidSchluessel: string; onGeaendert: () => void }) => {
  const umgebung = browserUmgebung(api);
  const [stand, setStand] = createSignal<Stand | null>(null);
  const [fehler, setFehler] = createSignal("");
  const [laeuft, setLaeuft] = createSignal(false);
  void standLesen(umgebung).then(setStand);
  const schalten = async () => {
    setLaeuft(true);
    const ergebnis =
      stand() === "an"
        ? await ausschalten(umgebung)
        : await einschalten(umgebung, props.vapidSchluessel, getLocale());
    setLaeuft(false);
    setFehler(ergebnis.ok ? "" : FEHLER[ergebnis.grund]());
    setStand(await standLesen(umgebung));
    props.onGeaendert();
  };
  return (
    <div class="flex flex-col items-start gap-2">
      <Show
        when={stand() !== "nicht_verfuegbar"}
        fallback={<p class="text-muted-foreground">{m.erinnerungen_geraet_nicht_verfuegbar()}</p>}
      >
        <p role="status">
          {stand() === "an" ? m.erinnerungen_geraet_an() : m.erinnerungen_geraet_aus()}
        </p>
        <Button variant="outline" disabled={stand() === null || laeuft()} onClick={schalten}>
          {stand() === "an" ? m.erinnerungen_ausschalten() : m.erinnerungen_einschalten()}
        </Button>
      </Show>
      <Fehler text={fehler()} />
    </div>
  );
};

import { Button } from "@soll/ui";
import { createSignal, Show } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { aktuellerBetrieb, sitzungNeu } from "../sitzung/sitzung.ts";
import { zeitpunktText } from "../zeiten/text.ts";
import { Fehler } from "./karte.tsx";

/**
 * Soll switched working time on by itself, because the first employed person joined a business
 * without it (S-603): the owner reads why, on every page, until confirming it. The server sends the
 * notice to the owner only.
 */
export const PflichtHinweis = () => {
  const [fehler, setFehler] = createSignal("");
  const hinweis = () => aktuellerBetrieb()?.hinweis ?? null;
  const bestaetigen = async () => {
    const antwort = await api("/api/v1/betrieb/hinweis", { method: "DELETE" });
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    setFehler("");
    await sitzungNeu();
  };
  return (
    <Show when={hinweis()}>
      {(h) => (
        <section
          aria-labelledby="pflicht-hinweis"
          class="flex max-w-2xl flex-col items-start gap-3 rounded-xl bg-warning-surface px-4 py-3.5"
        >
          <h2 id="pflicht-hinweis" class="font-semibold">
            {m.pflicht_hinweis_titel()}
          </h2>
          <p>{m.pflicht_hinweis_text({ zeitpunkt: zeitpunktText(h().am) })}</p>
          <Button variant="outline" onClick={bestaetigen}>
            {m.pflicht_hinweis_ok()}
          </Button>
          <Fehler text={fehler()} />
        </section>
      )}
    </Show>
  );
};

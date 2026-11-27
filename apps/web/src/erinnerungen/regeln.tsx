import { Button, Input } from "@soll/ui";
import { createSignal, untrack } from "solid-js";
import { aenderung } from "../abfragen/abfrage.ts";
import { alle } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { PFAD } from "./push.ts";
import type { Regeln } from "./typen.ts";

/** A whole number from a field, or null for anything else (never a fraction: CLAUDE.md) */
const ganz = (wert: string): number | null => (/^\d+$/.test(wert.trim()) ? Number(wert) : null);

/** The times of the business, for the owner (S-307); the server checks their limits */
export const RegelnFormular = (props: { regeln: Regeln }) => {
  // the form starts from the times as loaded and then belongs to the owner's typing: plain signals,
  // read once, because a field derived from the query would be reset (and a write to it held) each
  // time the reminders load again, as they do after every change on the page
  const anfang = untrack(() => ({
    stunden: String(Math.floor(props.regeln.gehenMinuten / 60)),
    vorlauf: String(props.regeln.pauseVorlauf),
    tag: String(props.regeln.monatTag),
  }));
  const [stunden, setStunden] = createSignal(anfang.stunden);
  const [vorlauf, setVorlauf] = createSignal(anfang.vorlauf);
  const [tag, setTag] = createSignal(anfang.tag);
  const senden = aenderung(
    (regeln: Record<keyof Regeln, number | null>) =>
      api(`${PFAD}/regeln`, { method: "PUT", body: regeln }),
    () => [alle(PFAD)],
  );
  const [meldung, setMeldung] = createSignal("");
  const [fehler, setFehler] = createSignal("");
  const speichern = async (event: SubmitEvent) => {
    event.preventDefault();
    const h = ganz(stunden());
    const regeln = {
      gehenMinuten: h === null ? null : h * 60,
      pauseVorlauf: ganz(vorlauf()),
      monatTag: ganz(tag()),
    };
    const antwort = await senden.mutate(regeln);
    setFehler(
      antwort.ok
        ? ""
        : antwort.status === 400
          ? m.erinnerungen_regeln_ungueltig()
          : m.fehler_speichern(),
    );
    setMeldung(antwort.ok ? m.erinnerungen_regeln_gespeichert() : "");
  };
  return (
    <form class="flex flex-col gap-3 border-border border-t pt-4" onSubmit={speichern}>
      <h3 class="font-medium">{m.erinnerungen_regeln_titel()}</h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label={m.erinnerungen_regeln_gehen()}
          hinweis={m.erinnerungen_regeln_gehen_hinweis()}
          inputmode="numeric"
          value={stunden()}
          onInput={(event) => setStunden(event.currentTarget.value)}
        />
        <Input
          label={m.erinnerungen_regeln_pause()}
          hinweis={m.erinnerungen_regeln_pause_hinweis()}
          inputmode="numeric"
          value={vorlauf()}
          onInput={(event) => setVorlauf(event.currentTarget.value)}
        />
        <Input
          label={m.erinnerungen_regeln_monat()}
          hinweis={m.erinnerungen_regeln_monat_hinweis()}
          inputmode="numeric"
          value={tag()}
          onInput={(event) => setTag(event.currentTarget.value)}
        />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline">
          {m.erinnerungen_regeln_speichern()}
        </Button>
        <p role="status" class="text-muted-foreground">
          {meldung()}
        </p>
      </div>
      <Fehler text={fehler()} />
    </form>
  );
};

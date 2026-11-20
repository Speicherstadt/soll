import { Button, Input } from "@soll/ui";
import { createSignal, untrack } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import type { Regeln } from "./typen.ts";

/** A whole number from a field, or null for anything else (never a fraction: CLAUDE.md) */
const ganz = (wert: string): number | null => (/^\d+$/.test(wert.trim()) ? Number(wert) : null);

/** The times of the business, for the owner (S-307); the server checks their limits */
export const RegelnFormular = (props: { regeln: Regeln }) => {
  // the form starts from the times as loaded and then belongs to the owner's typing
  const anfang = untrack(() => props.regeln);
  const [stunden, setStunden] = createSignal(String(Math.floor(anfang.gehenMinuten / 60)));
  const [vorlauf, setVorlauf] = createSignal(String(anfang.pauseVorlauf));
  const [tag, setTag] = createSignal(String(anfang.monatTag));
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
    const antwort = await api(`/api/v1/arbeitszeit/erinnerungen/regeln`, {
      method: "PUT",
      body: regeln,
    });
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
    <form class="flex flex-col gap-3" onSubmit={speichern}>
      <h3 class="font-medium">{m.erinnerungen_regeln_titel()}</h3>
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
      <div>
        <Button type="submit" variant="outline">
          {m.erinnerungen_regeln_speichern()}
        </Button>
      </div>
      <p role="status" class="text-muted-foreground">
        {meldung()}
      </p>
      <Fehler text={fehler()} />
    </form>
  );
};

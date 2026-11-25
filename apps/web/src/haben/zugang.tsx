import { Button, Input } from "@soll/ui";
import { createSignal, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { zugangEntfernen, zugangSpeichern } from "./quelle.ts";
import { habenFehler } from "./text.ts";
import type { HabenZugang } from "./typen.ts";

/**
 * Address and API token of the business's Haben: the owner keeps them (the token is shown never
 * again, only that one is kept), the planner sees where Soll sends to
 */
export const ZugangFormular = (props: { zugang: HabenZugang | null; inhaber: boolean }) => {
  const [fehler, setFehler] = createSignal("");
  const speichern = zugangSpeichern();
  const entfernen = zugangEntfernen();
  const senden = async (form: HTMLFormElement) => {
    const daten = new FormData(form);
    const token = String(daten.get("token") ?? "").trim();
    const antwort = await speichern.mutate({
      adresse: String(daten.get("adresse") ?? "").trim(),
      ...(token ? { token } : {}),
    });
    setFehler(
      antwort.ok
        ? ""
        : antwort.fehler === "ungueltig"
          ? m.haben_fehler_adresse()
          : habenFehler(antwort.fehler),
    );
    if (antwort.ok) (form.elements.namedItem("token") as HTMLInputElement).value = "";
  };
  return (
    <Show
      when={props.inhaber}
      fallback={
        <p class="text-muted-foreground">
          {props.zugang
            ? m.haben_verbunden_mit({ adresse: props.zugang.adresse })
            : m.haben_nur_inhaber()}
        </p>
      }
    >
      <form
        aria-label={m.haben_zugang()}
        class="flex flex-col gap-3 rounded-lg border border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void senden(event.currentTarget);
        }}
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-start">
          <Input
            label={m.haben_adresse()}
            name="adresse"
            type="url"
            required
            maxlength={500}
            value={props.zugang?.adresse ?? ""}
            class="md:w-72"
          />
          <Input
            label={m.haben_token()}
            name="token"
            type="password"
            autocomplete="off"
            maxlength={500}
            required={!props.zugang}
            hinweis={props.zugang ? m.haben_token_gesetzt() : m.haben_token_hinweis()}
            class="md:w-72"
          />
        </div>
        <div class="flex gap-2">
          <Button type="submit" variant="outline" disabled={speichern.isPending}>
            {m.haben_speichern()}
          </Button>
          <Show when={props.zugang}>
            <Button
              variant="ghost"
              disabled={entfernen.isPending}
              onClick={async () => {
                const antwort = await entfernen.mutate();
                setFehler(antwort.ok ? "" : habenFehler(antwort.fehler));
              }}
            >
              {m.haben_entfernen()}
            </Button>
          </Show>
        </div>
        <Fehler text={fehler()} />
      </form>
    </Show>
  );
};

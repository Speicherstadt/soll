import { Button, Icon } from "@soll/ui";
import { createFileRoute } from "@tanstack/solid-router";
import { CircleCheck, TriangleAlert } from "lucide";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { datumText, kurzerTag, monatText, tageText } from "../monat/text.ts";
import type { Pruefung } from "../monat/typen.ts";
import { saldoText } from "../monat/zeilen.ts";
import { m } from "../paraglide/messages.js";
import { Fehler, KartenSeite } from "../rahmen/karte.tsx";

/** What an Abweichung says when it names no days: the chain or the closing itself changed */
const ABWEICHUNG: Record<string, () => string> = {
  kette: () => m.pruefen_abweichung_kette(),
  abschluss: () => m.pruefen_abweichung_abschluss(),
};

const Ergebnis = (props: { pruefung: Pruefung }) => {
  const art = () => props.pruefung.ergebnis;
  const mitMonat = () => ("name" in props.pruefung ? props.pruefung : null);
  const okText = () => {
    const p = mitMonat();
    return p
      ? m.pruefen_ok_text({
          monat: monatText(p.monat),
          name: p.name,
          betrieb: p.betrieb,
          datum: datumText(p.abgeschlossenAm),
        })
      : "";
  };
  const abweichungText = () => {
    const p = mitMonat();
    if (p)
      return m.pruefen_abweichung_tage({
        monat: monatText(p.monat),
        name: p.name,
        tage: tageText(p.tage),
      });
    const grund = "grund" in props.pruefung ? props.pruefung.grund : null;
    return (ABWEICHUNG[grund ?? ""] ?? (() => ""))();
  };
  const gegeneintraege = () => mitMonat()?.gegeneintraege ?? [];
  return (
    <div role="status" class="flex flex-col gap-2">
      <Show when={art() === "unlesbar"}>
        <p class="text-danger">{m.pruefen_unlesbar()}</p>
      </Show>
      <Show when={art() === "unbekannt"}>
        <p class="text-danger">{m.pruefen_unbekannt()}</p>
      </Show>
      <Show when={art() === "uebereinstimmend"}>
        <p class="flex items-center gap-2 font-semibold text-[17px] text-success">
          <Icon icon={CircleCheck} size={20} />
          {m.pruefen_ok()}
        </p>
        <p>{okText()}</p>
      </Show>
      <Show when={art() === "abweichung"}>
        <p class="flex items-center gap-2 font-semibold text-[17px] text-danger">
          <Icon icon={TriangleAlert} size={20} />
          {m.pruefen_abweichung()}
        </p>
        <p>{abweichungText()}</p>
      </Show>
      <Show when={gegeneintraege().length > 0}>
        <p class="text-muted-foreground">{m.pruefen_gegeneintraege()}</p>
        <ul class="flex flex-col gap-1">
          <For each={gegeneintraege()}>
            {(eintrag) => (
              <li>
                {m.monat_gegeneintrag_zeile({
                  tag: kurzerTag(eintrag.tag),
                  minuten: saldoText(eintrag.minuten),
                  grund: eintrag.grund,
                })}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
};

/**
 * Prüfseite (S-306): a person, also one who left, or an inspector types the Prüfwert of a time sheet
 * and learns whether the month is still as it was closed. Open without signing in (docs/plan.md).
 */
const PruefSeite = () => {
  const id = createUniqueId();
  const suche = Route.useSearch();
  const [pruefung, setPruefung] = createSignal<Pruefung | null>(null);
  const [fehler, setFehler] = createSignal("");
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const daten = new FormData(event.currentTarget as HTMLFormElement);
    const antwort = await api<Pruefung>("/api/v1/pruefen", {
      body: {
        betriebId: String(daten.get("betrieb") ?? "").trim(),
        pruefwert: String(daten.get("pruefwert") ?? "").trim(),
      },
    });
    setFehler(antwort.ok ? "" : antwort.status === 0 ? m.fehler_netz() : m.pruefen_fehler());
    setPruefung(antwort.ok ? antwort.daten : null);
  };
  return (
    <KartenSeite titel={m.pruefen_titel()}>
      <p class="text-muted-foreground">{m.pruefen_text()}</p>
      <form class="flex flex-col gap-4" onSubmit={absenden}>
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-betrieb`} class="font-medium">
            {m.pruefen_betrieb()}
          </label>
          <input
            id={`${id}-betrieb`}
            name="betrieb"
            class={`${feld} font-mono`}
            value={suche().betrieb}
            required
            dir="ltr"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-wert`} class="font-medium">
            {m.pruefen_wert()}
          </label>
          <textarea
            id={`${id}-wert`}
            name="pruefwert"
            rows={3}
            required
            dir="ltr"
            placeholder={m.pruefen_wert_beispiel()}
            class={`${feld} h-auto py-1.5 font-mono text-[12px]`}
          />
        </div>
        <Fehler text={fehler()} />
        <Button type="submit" size="lg">
          {m.pruefen_knopf()}
        </Button>
      </form>
      <Show when={pruefung()}>{(p) => <Ergebnis pruefung={p()} />}</Show>
    </KartenSeite>
  );
};

export const Route = createFileRoute("/pruefen")({
  component: PruefSeite,
  validateSearch: (suche: Record<string, unknown>): { betrieb: string } => ({
    betrieb: typeof suche.betrieb === "string" ? suche.betrieb : "",
  }),
});

import { Button, Input } from "@soll/ui";
import { createSignal, For, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten, schreiben } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { codeAnzeige } from "../terminal/eingabe.ts";
import { uhrzeitText, zeitpunktText } from "../zeiten/text.ts";
import { type OfflineStand, TerminalOffline } from "./terminalOffline.tsx";

type Geraet = {
  terminalId: string;
  name: string;
  gekoppeltAm: number | null;
  kopplungBis: number | null;
  gesperrtBis: number | null;
  offline?: OfflineStand;
};

const statusText = (geraet: Geraet): string => {
  if (geraet.gesperrtBis !== null)
    return m.terminal_gesperrt_bis({ uhrzeit: uhrzeitText(geraet.gesperrtBis) });
  if (geraet.gekoppeltAm !== null)
    return m.terminal_gekoppelt_am({ zeitpunkt: zeitpunktText(geraet.gekoppeltAm) });
  return m.terminal_wartet({ uhrzeit: uhrzeitText(geraet.kopplungBis ?? 0) });
};

/**
 * The owner's terminals (S-801): a pairing code for a new tablet, shown once with where to type it
 * and until when; the list of tablets with their state, each revocable at once, a locked one also
 * to be unlocked; gaps and refusals of a tablet's offline queue below it (S-803)
 */
export const TerminalGeraete = () => {
  const abgefragt = abfrage<{ terminals: Geraet[] }>(ressourcen.terminalGeraete);
  const geraete = () => daten(abgefragt.data)?.terminals ?? [];
  const [code, setCode] = createSignal<{ code: string; gueltigBis: number } | null>(null);
  const [fehler, setFehler] = createSignal("");
  const AENDERT = () => [alle(PFAD.terminalGeraete)];
  const anlegen = aenderung(
    (name: string) =>
      api<{ code: string; gueltigBis: number }>(PFAD.terminalGeraete, { body: { name } }),
    AENDERT,
  );
  const aendern = schreiben(AENDERT);
  const koppeln = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const antwort = await anlegen.mutate(String(new FormData(form).get("name") ?? "").trim());
    if (!antwort.ok)
      return setFehler(antwort.status === 0 ? m.fehler_netz() : m.fehler_speichern());
    setFehler("");
    setCode(antwort.daten);
    form.reset();
  };
  const geraetPfad = (geraet: Geraet) => `${PFAD.terminalGeraete}/${geraet.terminalId}`;
  const nach = async (auftrag: () => ReturnType<typeof api>) => {
    const antwort = await aendern.mutate(auftrag);
    setFehler(antwort.ok ? "" : m.fehler_speichern());
  };
  const entkoppeln = (geraet: Geraet) => nach(() => api(geraetPfad(geraet), { method: "DELETE" }));
  const entsperren = (geraet: Geraet) =>
    nach(() => api(`${geraetPfad(geraet)}/entsperren`, { body: {} }));
  return (
    <section class="flex max-w-lg flex-col gap-3">
      <h2 class="font-semibold">{m.terminal_titel()}</h2>
      <p class="text-muted-foreground">{m.terminal_text()}</p>
      <form class="flex items-end gap-2" onSubmit={koppeln}>
        <Input
          class="flex-1"
          label={m.terminal_geraet_name()}
          name="name"
          required
          maxlength={80}
        />
        <Button type="submit" disabled={anlegen.isPending}>
          {m.terminal_koppeln()}
        </Button>
      </form>
      <Show when={code()}>
        {(neu) => (
          <div role="status" class="flex flex-col gap-1 rounded-lg border border-border p-3">
            <span class="font-medium">{m.terminal_code_titel()}</span>
            <span class="font-mono font-semibold text-[28px] tracking-widest" data-testid="code">
              {codeAnzeige(neu().code)}
            </span>
            <span class="text-muted-foreground">
              {m.terminal_code_text({
                adresse: `${location.origin}/terminal`,
                uhrzeit: uhrzeitText(neu().gueltigBis),
              })}
            </span>
          </div>
        )}
      </Show>
      <Loading>
        <Show
          when={geraete().length > 0}
          fallback={<p class="text-muted-foreground">{m.terminal_keine()}</p>}
        >
          <ul class="flex flex-col gap-2">
            <For each={geraete()} keyed={(geraet) => geraet.terminalId}>
              {(geraet) => (
                <li class="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <span class="flex flex-col">
                    <span class="font-medium">{geraet().name}</span>
                    <span class="text-muted-foreground">{statusText(geraet())}</span>
                    <TerminalOffline stand={geraet().offline} />
                  </span>
                  <span class="flex gap-2">
                    <Show when={geraet().gesperrtBis !== null}>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={m.terminal_entsperren_name({ name: geraet().name })}
                        onClick={() => entsperren(geraet())}
                      >
                        {m.terminal_entsperren()}
                      </Button>
                    </Show>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={m.terminal_entkoppeln_name({ name: geraet().name })}
                      onClick={() => entkoppeln(geraet())}
                    >
                      {m.terminal_entkoppeln()}
                    </Button>
                  </span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Loading>
      <Fehler text={fehler()} />
    </section>
  );
};

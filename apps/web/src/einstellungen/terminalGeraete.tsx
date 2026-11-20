import { Button, Input } from "@soll/ui";
import { createSignal, For, Show } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { codeAnzeige } from "../terminal/eingabe.ts";
import { uhrzeitText, zeitpunktText } from "../zeiten/text.ts";

type Geraet = {
  terminalId: string;
  name: string;
  gekoppeltAm: number | null;
  kopplungBis: number | null;
  gesperrtBis: number | null;
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
 * to be unlocked
 */
export const TerminalGeraete = () => {
  const [geraete, setGeraete] = createSignal<Geraet[]>([]);
  const [code, setCode] = createSignal<{ code: string; gueltigBis: number } | null>(null);
  const [fehler, setFehler] = createSignal("");
  const laden = async () => {
    const antwort = await api<{ terminals: Geraet[] }>("/api/v1/terminal/geraete");
    if (antwort.ok) setGeraete(antwort.daten.terminals);
  };
  void laden();
  const koppeln = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const name = String(new FormData(form).get("name") ?? "").trim();
    const antwort = await api<{ code: string; gueltigBis: number }>("/api/v1/terminal/geraete", {
      body: { name },
    });
    if (!antwort.ok)
      return setFehler(antwort.status === 0 ? m.fehler_netz() : m.fehler_speichern());
    setFehler("");
    setCode(antwort.daten);
    form.reset();
    await laden();
  };
  const entkoppeln = async (geraet: Geraet) => {
    const antwort = await api(`/api/v1/terminal/geraete/${geraet.terminalId}`, {
      method: "DELETE",
    });
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    await laden();
  };
  const entsperren = async (geraet: Geraet) => {
    const antwort = await api(`/api/v1/terminal/geraete/${geraet.terminalId}/entsperren`, {
      body: {},
    });
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    await laden();
  };
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
        <Button type="submit">{m.terminal_koppeln()}</Button>
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
      <Fehler text={fehler()} />
    </section>
  );
};

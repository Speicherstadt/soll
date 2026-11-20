import { Button, Dialog } from "@soll/ui";
import { createSignal, For, Show, untrack } from "solid-js";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Feld, TextFeld, ZahlFeld, ZeitFeld } from "./felder.tsx";
import { minutenSpanne, wochentagName } from "./text.ts";
import type { BedarfZeile } from "./typen.ts";

type Entwurf = Omit<BedarfZeile, "bedarfId" | "standortId">;

const LEER: Entwurf = {
  rolle: "",
  wochentag: 1,
  beginnMinute: 14 * 60,
  endeMinute: 22 * 60,
  anzahl: 1,
};
const WOCHENTAGE = [1, 2, 3, 4, 5, 6, 7];

export const bedarfText = (bedarf: Entwurf): string =>
  `${wochentagName(bedarf.wochentag)} ${minutenSpanne(bedarf.beginnMinute, bedarf.endeMinute)} · ${bedarf.rolle} · ${bedarf.anzahl}`;

/** The fields of a need: weekday, role, times and how many people */
const BedarfFelder = (props: {
  entwurf: Entwurf;
  rollen: readonly string[];
  setze: (teil: Partial<Entwurf>) => void;
}) => (
  <div class="grid grid-cols-2 gap-3">
    <Feld
      label={m.plan_wochentag()}
      kind={(id) => (
        <select
          id={id}
          class={feld}
          value={String(props.entwurf.wochentag)}
          onChange={(e) => props.setze({ wochentag: Number(e.currentTarget.value) })}
        >
          <For each={WOCHENTAGE}>
            {(tag) => <option value={String(tag)}>{wochentagName(tag)}</option>}
          </For>
        </select>
      )}
    />
    <TextFeld
      label={m.plan_rolle()}
      wert={props.entwurf.rolle}
      vorschlaege={props.rollen}
      onWert={(rolle) => props.setze({ rolle })}
    />
    <ZeitFeld
      label={m.plan_beginn()}
      minute={props.entwurf.beginnMinute}
      onMinute={(beginnMinute) => props.setze({ beginnMinute })}
    />
    <ZeitFeld
      label={m.plan_ende()}
      minute={props.entwurf.endeMinute}
      onMinute={(endeMinute) => props.setze({ endeMinute })}
    />
    <ZahlFeld
      label={m.plan_anzahl()}
      wert={props.entwurf.anzahl}
      min={1}
      max={99}
      onWert={(anzahl) => props.setze({ anzahl })}
    />
  </div>
);

/** The need per role of a site, every week (S-501): list, add and remove */
export const BedarfDialog = (props: {
  standortId: string;
  rollen: readonly string[];
  onSchliessen: () => void;
  onGeaendert: () => void;
}) => {
  // the dialog belongs to the site it was opened for
  const standortId = untrack(() => props.standortId);
  const [offen, setOffen] = createSignal(true);
  const [bedarfe, setBedarfe] = createSignal<BedarfZeile[]>([]);
  const [entwurf, setEntwurf] = createSignal<Entwurf>(LEER);
  const [fehler, setFehler] = createSignal("");
  const laden = async () => {
    const frage = new URLSearchParams({ standortId });
    const antwort = await api<{ bedarfe: BedarfZeile[] }>(`/api/v1/dienstplan/bedarf?${frage}`);
    if (antwort.ok) setBedarfe(antwort.daten.bedarfe);
  };
  void laden();
  const fertig = async (ok: boolean, text: string) => {
    setFehler(ok ? "" : text);
    if (!ok) return;
    await laden();
    props.onGeaendert();
  };
  const anlegen = async (event: SubmitEvent) => {
    event.preventDefault();
    const neu = { ...entwurf(), rolle: entwurf().rolle.trim(), standortId };
    if (neu.rolle === "") return setFehler(m.plan_fehler_rolle());
    await fertig(
      (await api("/api/v1/dienstplan/bedarf", { body: neu })).ok,
      m.plan_fehler_eingabe(),
    );
  };
  const entfernen = async (bedarf: BedarfZeile) =>
    fertig(
      (await api(`/api/v1/dienstplan/bedarf/${bedarf.bedarfId}`, { method: "DELETE" })).ok,
      m.fehler_speichern(),
    );
  return (
    <Dialog offen={offen()} titel={m.plan_bedarf_titel()} onSchliessen={props.onSchliessen}>
      <div class="flex flex-col gap-4">
        <Show
          when={bedarfe().length > 0}
          fallback={<p class="text-muted-foreground">{m.plan_bedarf_leer()}</p>}
        >
          <ul class="m-0 flex list-none flex-col gap-1 p-0">
            <For each={bedarfe()}>
              {(bedarf) => (
                <li class="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
                  <span class="me-auto">{bedarfText(bedarf)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-danger"
                    onClick={() => void entfernen(bedarf)}
                  >
                    {m.plan_entfernen()}
                    <span class="sr-only">{bedarfText(bedarf)}</span>
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <form class="flex flex-col gap-3 border-border border-t pt-4" onSubmit={anlegen} novalidate>
          <h3 class="font-semibold">{m.plan_bedarf_neu()}</h3>
          <BedarfFelder
            entwurf={entwurf()}
            rollen={props.rollen}
            setze={(teil) => setEntwurf((alt) => ({ ...alt, ...teil }))}
          />
          <Fehler text={fehler()} />
          <div class="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOffen(false)}>
              {m.plan_schliessen()}
            </Button>
            <Button type="submit">{m.plan_bedarf_neu()}</Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};

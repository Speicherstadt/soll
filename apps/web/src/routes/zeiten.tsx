import { plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { Button, Icon } from "@soll/ui";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { ChevronLeft, ChevronRight } from "lucide";
import { createSignal, createUniqueId, For, Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { feld, knopfLink } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Seite } from "../rahmen/seite.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { ModellWahl } from "../zeiten/modellWahl.tsx";
import { tagQuelle } from "../zeiten/quelle.ts";
import { TagAnsicht } from "../zeiten/tagAnsicht.tsx";
import type { Person } from "../zeiten/typen.ts";

const hatRolle = (...rollen: string[]) =>
  (aktuellerBetrieb()?.rolle ?? "").split(",").some((rolle) => rollen.includes(rolle.trim()));

/**
 * Zeiten: the times of a day. Everyone sees their own; owner, planner and payroll choose a person,
 * owner and planner correct with a reason, the owner assigns the working-time model (S-304).
 */
const Zeiten = () => {
  const id = createUniqueId();
  const [datum, setDatum] = createSignal(tagInBerlin(Date.now()));
  const [nutzerId, setNutzerId] = createSignal<string | undefined>(undefined);
  const personenAbfrage = abfrage<{ personen: Person[] }>(ressourcen.personen);
  const personen = () => daten(personenAbfrage.data)?.personen ?? [];
  const quelle = tagQuelle(() => ({ datum: datum(), nutzerId: nutzerId() }));
  const eigene = () => {
    const ansicht = quelle.ansicht();
    return ansicht === null || nutzerId() === undefined || ansicht.nutzerId === nutzerId();
  };
  // one's own times everyone corrects; another's the owner and the planner (rollen.ts on the server)
  const darfKorrigieren = () => eigene() || hatRolle("inhaber", "planer");
  return (
    <Seite titel={m.nav_zeiten()}>
      <div class="flex max-w-2xl flex-wrap items-end gap-3">
        <Loading>
          <Show when={personen().length > 0}>
            <div class="flex min-w-48 flex-col gap-1.5">
              <label for={`${id}-person`} class="font-medium">
                {m.zeiten_person()}
              </label>
              <select
                id={`${id}-person`}
                class={feld}
                value={quelle.ansicht()?.nutzerId ?? ""}
                onChange={(event) => setNutzerId(event.currentTarget.value)}
              >
                <For each={personen()}>
                  {(person) => <option value={person.nutzerId}>{person.name}</option>}
                </For>
              </select>
            </div>
          </Show>
        </Loading>
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-datum`} class="font-medium">
            {m.zeiten_datum()}
          </label>
          <div class="flex items-center gap-1">
            <Button
              variant="icon"
              aria-label={m.zeiten_vortag()}
              onClick={() => setDatum((tag) => plusTage(tag, -1))}
            >
              <Icon icon={ChevronLeft} class="rtl:rotate-180" />
            </Button>
            <input
              id={`${id}-datum`}
              type="date"
              class={feld}
              value={datum()}
              onChange={(event) => event.currentTarget.value && setDatum(event.currentTarget.value)}
            />
            <Button
              variant="icon"
              aria-label={m.zeiten_folgetag()}
              onClick={() => setDatum((tag) => plusTage(tag, 1))}
            >
              <Icon icon={ChevronRight} class="rtl:rotate-180" />
            </Button>
          </div>
        </div>
        <Link to="/monat" class={knopfLink}>
          {m.monat_titel()}
        </Link>
        <Loading>
          <Show when={hatRolle("inhaber") && quelle.ansicht()}>
            {(ansicht) => (
              <ModellWahl
                nutzerId={ansicht().nutzerId}
                modellId={
                  personen().find((p) => p.nutzerId === ansicht().nutzerId)?.modellId ?? null
                }
              />
            )}
          </Show>
        </Loading>
      </div>
      <Loading>
        <Fehler text={quelle.fehler() ? m.laden_fehler() : ""} />
        <Show when={quelle.ansicht() && quelle.stand()}>
          <TagAnsicht
            ansicht={quelle.ansicht() as NonNullable<ReturnType<typeof quelle.ansicht>>}
            stand={quelle.stand() as NonNullable<ReturnType<typeof quelle.stand>>}
            darfKorrigieren={darfKorrigieren()}
          />
        </Show>
      </Loading>
    </Seite>
  );
};

export const Route = createFileRoute("/zeiten")({ component: Zeiten });

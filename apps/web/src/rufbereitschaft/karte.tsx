import { tagInBerlin } from "@soll/arbeitszeit";
import { Button, Icon } from "@soll/ui";
import { PhoneCall, Plus, Square } from "lucide";
import { createSignal, createUniqueId, Show } from "solid-js";
import { spanneText, tagLang } from "../dienstplan/text.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { uhrzeitText } from "../zeiten/text.ts";
import { NachtragDialog } from "./nachtragDialog.tsx";
import { type Dienst, einsatzAktionen, einsatzFehler, einsatzStand } from "./quelle.ts";

/** The duty to name: the one that holds now, else the next or last one of the three days */
const gezeigterDienst = (jetzt: Dienst | null, naechste: readonly Dienst[]): Dienst | null =>
  jetzt ?? naechste.find((dienst) => dienst.beginn > Date.now()) ?? naechste.at(-1) ?? null;

/**
 * Rufbereitschaft on Heute (S-505): only while the person has a published duty from yesterday to
 * tomorrow. During the duty "Einsatz beginnen", then "Einsatz beenden" on the server's clock; a
 * call-out afterwards is added with its reason. Being on call is no working time, a call-out is.
 */
export const RufKarte = () => {
  const id = createUniqueId();
  const stand = einsatzStand();
  const aktionen = einsatzAktionen();
  const [fehler, setFehler] = createSignal("");
  const [nachtrag, setNachtrag] = createSignal(false);
  const nach = async (laeuft: Promise<{ ok: boolean; fehler?: string }>) => {
    const antwort = await laeuft;
    setFehler(antwort.ok ? "" : einsatzFehler(antwort.fehler ?? ""));
  };
  return (
    <Show when={stand()}>
      {(aktuell) => (
        <Show when={gezeigterDienst(aktuell().jetzt, aktuell().naechste)}>
          {(dienst) => (
            <section
              aria-labelledby={id}
              class="flex max-w-md flex-col gap-3 rounded-xl border border-border p-4"
            >
              <h2 id={id} class="flex items-center gap-2 font-semibold text-[15px]">
                <Icon icon={PhoneCall} size={18} />
                {m.oncall_title()}
              </h2>
              <p>
                {aktuell().jetzt
                  ? m.callout_now({ zeit: uhrzeitText(dienst().ende) })
                  : m.callout_next({ datum: tagLang(dienst().tag), zeit: spanneText(dienst()) })}
              </p>
              <p class="text-[12px] text-muted-foreground">{m.callout_explain()}</p>
              <Show when={aktuell().laufend}>
                {(laufend) => (
                  <p role="status" class="font-medium text-success">
                    {m.callout_running({ zeit: uhrzeitText(laufend().beginn) })}
                  </p>
                )}
              </Show>
              <Show
                when={aktuell().laufend}
                fallback={
                  <Show when={aktuell().jetzt}>
                    <Button
                      class="h-[52px] rounded-xl text-[16px]"
                      disabled={aktionen.beginnen.isPending}
                      onClick={() => void nach(aktionen.beginnen.mutate(undefined))}
                    >
                      <Icon icon={PhoneCall} size={20} />
                      {m.callout_start()}
                    </Button>
                  </Show>
                }
              >
                <Button
                  class="h-[52px] rounded-xl text-[16px]"
                  disabled={aktionen.beenden.isPending}
                  onClick={() => void nach(aktionen.beenden.mutate(undefined))}
                >
                  <Icon icon={Square} size={20} />
                  {m.callout_stop()}
                </Button>
              </Show>
              <Button variant="outline" class="self-start" onClick={() => setNachtrag(true)}>
                <Icon icon={Plus} />
                {m.callout_add()}
              </Button>
              <Fehler text={fehler()} />
              <Show when={nachtrag()}>
                <NachtragDialog
                  tag={dienst().tag ?? tagInBerlin(Date.now())}
                  onSchliessen={() => setNachtrag(false)}
                />
              </Show>
            </section>
          )}
        </Show>
      )}
    </Show>
  );
};

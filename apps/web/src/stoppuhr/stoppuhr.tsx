import { tagInBerlin } from "@soll/arbeitszeit";
import { Button, DatePicker, Icon } from "@soll/ui";
import { CircleAlert, Plus } from "lucide";
import { createSignal, createUniqueId, Loading, latest, Show } from "solid-js";
import type { Antwort } from "../api.ts";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { type BuchungBearbeiten, BuchungDialog } from "./dialog.tsx";
import { LaufendKarte, Wechsel } from "./laufend.tsx";
import { BuchungListe } from "./liste.tsx";
import { stoppuhrAktionen, stoppuhrQuelle } from "./quelle.ts";
import { buchungFehler } from "./text.ts";
import type { StoppuhrTag } from "./typen.ts";

/** More project time than stamped working time on the day: a hint with both sums, never a block */
const HinweisKarte = (props: { tag: StoppuhrTag }) => (
  <Show when={props.tag.hinweis}>
    {(hinweis) => (
      <div role="status" class="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
        <Icon icon={CircleAlert} class="mt-0.5 shrink-0 text-warning" />
        <span class="flex flex-col">
          <span class="font-medium">{m.stoppuhr_hinweis_titel()}</span>
          <span class="text-[12px] text-muted-foreground">
            {`${m.befund_hinweis()} · ${m.stoppuhr_hinweis_text({
              gebucht: dauerText(hinweis().gebuchtMinuten),
              gestempelt: dauerText(hinweis().gestempeltMinuten),
              ueber: dauerText(hinweis().ueberMinuten),
            })}`}
          </span>
        </span>
      </div>
    )}
  </Show>
);

const summeText = (tag: StoppuhrTag) =>
  tag.gestempeltMinuten === null
    ? m.stoppuhr_summe({ gebucht: dauerText(tag.gebuchtMinuten) })
    : m.stoppuhr_summe_gestempelt({
        gebucht: dauerText(tag.gebuchtMinuten),
        gestempelt: dauerText(tag.gestempeltMinuten),
      });

/**
 * The stopwatch (S-602) on Heute: the running booking with Stoppen, the switch in one tap, and the
 * bookings of a day with their sums, the hint, changes and bookings by hand
 */
export const Stoppuhr = () => {
  const id = createUniqueId();
  const [tag, setTag] = createSignal<string | undefined>(undefined);
  const [fehler, setFehler] = createSignal("");
  const [bearbeiten, setBearbeiten] = createSignal<BuchungBearbeiten | null>(null);
  const quelle = stoppuhrQuelle(tag);
  const aktionen = stoppuhrAktionen();
  const nach = async (schreiben: Promise<Antwort<unknown>>) => {
    const antwort = await schreiben;
    setFehler(antwort.ok ? "" : buchungFehler(antwort.fehler));
  };
  return (
    <section
      aria-labelledby={`${id}-titel`}
      class="flex h-full min-w-0 flex-col gap-4 rounded-xl border border-border bg-background p-5"
    >
      <h2 id={`${id}-titel`} class="font-semibold text-[17px] leading-7">
        {m.stoppuhr_titel()}
      </h2>
      <Loading>
        <Show
          when={quelle.ansicht()}
          fallback={<Fehler text={quelle.fehler() ? m.laden_fehler() : ""} />}
        >
          {(ansicht) => (
            <>
              <LaufendKarte
                quelle={quelle}
                laufend={ansicht().laufend}
                gebuchtMinuten={ansicht().gebuchtMinuten}
                gestempeltMinuten={ansicht().gestempeltMinuten}
                summe={summeText(ansicht())}
                arbeitet={aktionen.arbeitet()}
                onStoppen={() => nach(aktionen.stoppen())}
              />
              <Wechsel
                quelle={quelle}
                zuletzt={ansicht().zuletzt}
                laufend={ansicht().laufend}
                arbeitet={aktionen.arbeitet()}
                onStarten={(wahl) => nach(aktionen.starten(wahl))}
              />
              <Fehler text={fehler()} />
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div class="flex flex-col gap-1.5">
                  <label for={`${id}-tag`} class="font-medium">
                    {m.stoppuhr_tag()}
                  </label>
                  <DatePicker
                    id={`${id}-tag`}
                    value={ansicht().tag}
                    onValue={(wert) => setTag(wert || undefined)}
                  />
                </div>
              </div>
              <HinweisKarte tag={ansicht()} />
              <Show
                when={ansicht().buchungen.length > 0}
                fallback={<p class="text-muted-foreground">{m.stoppuhr_leer()}</p>}
              >
                <BuchungListe
                  quelle={quelle}
                  buchungen={ansicht().buchungen}
                  mitSchicht={ansicht().gestempeltMinuten !== null}
                  onAendern={(buchung) => setBearbeiten({ modus: "aendern", buchung })}
                  onEntfernen={(buchung) => nach(aktionen.entfernen(buchung.buchungId))}
                />
              </Show>
              <Button
                variant="outline"
                class="self-start"
                // the day chosen, even while its bookings still load: tag() still reads the day before
                // until the new day's answer lands (Solid 2 holds the write), latest() the day chosen.
                // No day chosen is today by the stopwatch's clock: the day shown is held as well
                onClick={() =>
                  setBearbeiten({
                    modus: "nachtragen",
                    tag: latest(tag) ?? tagInBerlin(quelle.jetzt()),
                  })
                }
              >
                <Icon icon={Plus} />
                {m.buchung_nachtragen()}
              </Button>
            </>
          )}
        </Show>
      </Loading>
      <Show when={bearbeiten()}>
        {(aktuell) => (
          <BuchungDialog
            bearbeiten={aktuell()}
            quelle={quelle}
            aktionen={aktionen}
            onSchliessen={() => setBearbeiten(null)}
          />
        )}
      </Show>
    </section>
  );
};

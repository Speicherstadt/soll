import { tagInBerlin } from "@soll/arbeitszeit";
import { Button, DatePicker, Dialog, Icon } from "@soll/ui";
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
import { buchungFehler, wahlText } from "./text.ts";
import type { Buchung, StoppuhrTag } from "./typen.ts";

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

const BuchungLoeschenDialog = (props: {
  ziel: Buchung | null;
  quelle: ReturnType<typeof stoppuhrQuelle>;
  arbeitet: boolean;
  onAbbrechen: () => void;
  onBestaetigen: (buchungId: string) => void;
}) => (
  <Dialog
    offen={props.ziel !== null}
    titel={m.buchung_loeschen_titel()}
    onSchliessen={props.onAbbrechen}
    aktionen={
      <>
        <Button variant="outline" onClick={props.onAbbrechen}>
          {m.abbrechen()}
        </Button>
        <Button
          variant="outline"
          class="text-danger"
          disabled={props.arbeitet}
          onClick={() => {
            if (props.ziel) props.onBestaetigen(props.ziel.buchungId);
          }}
        >
          {m.buchung_loeschen_knopf()}
        </Button>
      </>
    }
  >
    <Show when={props.ziel}>
      {(ziel) => (
        <p class="text-muted-foreground">
          {m.buchung_loeschen_text({
            name: wahlText(props.quelle.projekte(), props.quelle.taetigkeiten(), ziel()),
          })}
        </p>
      )}
    </Show>
  </Dialog>
);

/**
 * The stopwatch (S-602) on Heute: the running booking with Stoppen, the switch in one tap, and the
 * bookings of a day with their sums, the hint, changes and bookings by hand
 */
export const Stoppuhr = () => {
  const id = createUniqueId();
  const [tag, setTag] = createSignal<string | undefined>(undefined);
  const [fehler, setFehler] = createSignal("");
  const [bearbeiten, setBearbeiten] = createSignal<BuchungBearbeiten | null>(null);
  const [loeschen, setLoeschen] = createSignal<Buchung | null>(null);
  const quelle = stoppuhrQuelle(tag);
  const aktionen = stoppuhrAktionen();
  const nach = async (schreiben: Promise<Antwort<unknown>>) => {
    const antwort = await schreiben;
    setFehler(antwort.ok ? "" : buchungFehler(antwort.fehler));
  };
  return (
    <section
      aria-labelledby={`${id}-titel`}
      class="flex h-full min-w-0 flex-col gap-5 rounded-xl border border-border bg-background p-6"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-titel`} class="font-semibold text-[16px] leading-6">
          {m.stoppuhr_titel()}
        </h2>
        <Button
          variant="outline"
          class="min-h-11 px-3 text-[13px] md:h-8 md:min-h-8"
          onClick={() =>
            setBearbeiten({
              modus: "nachtragen",
              tag: latest(tag) ?? tagInBerlin(quelle.jetzt()),
            })
          }
        >
          <Icon icon={Plus} size={14} />
          {m.buchung_nachtragen()}
        </Button>
      </div>
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
              <div class="flex flex-col gap-4 border-border border-t pt-4">
                <div class="flex flex-wrap items-end justify-between gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label for={`${id}-tag`} class="font-medium text-[13px]">
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
                    onEntfernen={(buchung) => setLoeschen(buchung)}
                  />
                </Show>
              </div>
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
      <BuchungLoeschenDialog
        ziel={loeschen()}
        quelle={quelle}
        arbeitet={aktionen.arbeitet()}
        onAbbrechen={() => setLoeschen(null)}
        onBestaetigen={(buchungId) => {
          setLoeschen(null);
          void nach(aktionen.entfernen(buchungId));
        }}
      />
    </section>
  );
};

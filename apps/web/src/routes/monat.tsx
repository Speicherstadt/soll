import { Button } from "@soll/ui";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, Loading, Show } from "solid-js";
import { daten } from "../abfragen/abfrage.ts";
import { demoStundenzettelPdf } from "../demo/demoPdf.ts";
import { knopfLink } from "../einrichtung/stil.ts";
import { Auswahl } from "../monat/auswahl.tsx";
import { GegeneintragDialog, OhneBestaetigungDialog } from "../monat/dialoge.tsx";
import { MonatChart } from "../monat/monatChart.tsx";
import { Pruefwert } from "../monat/pruefwert.tsx";
import { monatQuelle } from "../monat/quelle.ts";
import { Stand } from "../monat/stand.tsx";
import { Startsalden } from "../monat/startsalden.tsx";
import { Gegeneintraege, Summen, TageTabelle } from "../monat/tabelle.tsx";
import { datumText, monatText, tageText, zeitpunktText } from "../monat/text.ts";
import type { MonatAnsicht } from "../monat/typen.ts";
import { zeilenDesMonats } from "../monat/zeilen.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Seite } from "../rahmen/seite.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { ZeitenWechsler } from "../zeiten/ansichtWechsler.tsx";

const hatRolle = (...rollen: string[]) =>
  (aktuellerBetrieb()?.rolle ?? "").split(",").some((rolle) => rollen.includes(rolle.trim()));

/** A month that has ended and is not closed yet (a removed month was closed, S-901) */
const offen = (a: MonatAnsicht) => a.vorbei && a.abschluss === null && a.ausgesondert === null;

const istDemo = import.meta.env.VITE_DEMO === "1";

/**
 * The actions of a month: the time sheet, a counter-entry once closed, and the one main action,
 * confirming one's own month or (for the owner) closing it (DESIGN.md, "Eine Hauptaktion")
 */
const Aktionen = (props: {
  ansicht: MonatAnsicht;
  abfrage: string;
  onBestaetigen: () => void;
  onAbschliessen: () => void;
  onGegeneintrag: () => void;
}) => {
  const bestaetigen = () =>
    offen(props.ansicht) && props.ansicht.eigen && !props.ansicht.bestaetigung?.gueltig;
  const demoPdfLaden = (event: MouseEvent) => {
    if (!istDemo) return;
    event.preventDefault();
    const blob = demoStundenzettelPdf(props.ansicht);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Stundenzettel_${props.ansicht.monat}_${props.ansicht.name.replace(/\s+/g, "_")}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div class="flex flex-wrap gap-2">
      <Show when={!props.ansicht.ausgesondert}>
        <a
          href={`/api/v1/arbeitszeit/monat/stundenzettel?${props.abfrage}`}
          download
          onClick={demoPdfLaden}
          class={knopfLink}
        >
          {m.monat_stundenzettel()}
        </a>
      </Show>
      <Show when={props.ansicht.abschluss && hatRolle("inhaber", "planer")}>
        <Button variant="outline" onClick={props.onGegeneintrag}>
          {m.monat_gegeneintrag()}
        </Button>
      </Show>
      <Show when={offen(props.ansicht) && hatRolle("inhaber")}>
        <Button variant={bestaetigen() ? "outline" : "primary"} onClick={props.onAbschliessen}>
          {m.monat_abschliessen()}
        </Button>
      </Show>
      <Show when={bestaetigen()}>
        <Button onClick={props.onBestaetigen}>{m.monat_bestaetigen()}</Button>
      </Show>
    </div>
  );
};

/** The records of a month: sums, chart, days, counter-entries and the Prüfwert */
const Inhalt = (props: { ansicht: MonatAnsicht }) => {
  const zeilen = () =>
    zeilenDesMonats(
      props.ansicht.inhalt.tage,
      props.ansicht.inhalt.befunde,
      props.ansicht.geaenderteTage,
      props.ansicht.abschluss?.am ?? Date.now(),
    );
  return (
    <>
      <Summen inhalt={props.ansicht.inhalt} />
      <MonatChart zeilen={zeilen()} />
      <TageTabelle zeilen={zeilen()} />
      <Gegeneintraege eintraege={props.ansicht.inhalt.gegeneintraege} />
      <Startsalden monat={props.ansicht.monat} salden={props.ansicht.inhalt.startsalden} />
      <Pruefwert
        name={props.ansicht.name}
        pruefwert={props.ansicht.abschluss?.pruefwert ?? null}
        betriebId={aktuellerBetrieb()?.betriebId ?? ""}
      />
    </>
  );
};

/**
 * Monatsabschluss (S-306): the days of a month with Soll and Ist, confirmed by the person and closed
 * by the owner, the time sheet as PDF and the Prüfwert (design/mockup/Monatsabschluss.dc.html)
 */
const MonatSeite = () => {
  const q = monatQuelle();
  const [dialog, setDialog] = createSignal<"ohne" | "gegeneintrag" | null>(null);
  /** the month as loaded; its first load suspends to the nearest Loading */
  const ansicht = () => daten(q.ansicht.data);
  const abschliessen = (a: MonatAnsicht) => {
    if (!a.bestaetigung?.gueltig) return setDialog("ohne");
    void q.schritt("/api/v1/arbeitszeit/monat/abschliessen", {
      monat: a.monat,
      nutzerId: a.nutzerId,
    });
  };
  return (
    <Seite
      titel={
        <Loading fallback={m.monat_titel()}>
          {ansicht()
            ? m.monat_titel_person({ monat: monatText(q.monat()), name: ansicht()?.name ?? "" })
            : m.monat_titel()}
        </Loading>
      }
    >
      <ZeitenWechsler aktiv="monat" />
      <Loading>
        <Auswahl
          personen={daten(q.personen.data)?.personen ?? []}
          nutzerId={q.nutzerId() ?? ansicht()?.nutzerId}
          monat={q.monat()}
          onPerson={q.setNutzerId}
          onMonat={q.setMonat}
        />
      </Loading>
      <Fehler text={q.fehler()} />
      <Show when={q.meldung()}>
        <p role="status">{q.meldung()}</p>
      </Show>
      <Loading>
        <Fehler text={q.ansicht.data.ok ? "" : m.laden_fehler()} />
        <Show when={ansicht()}>
          {(a) => (
            <>
              <div class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4">
                <Stand ansicht={a()} />
                <Aktionen
                  ansicht={a()}
                  abfrage={q.abfrage()}
                  onBestaetigen={() =>
                    void q.schritt("/api/v1/arbeitszeit/monat/bestaetigen", { monat: a().monat })
                  }
                  onAbschliessen={() => abschliessen(a())}
                  onGegeneintrag={() => setDialog("gegeneintrag")}
                />
              </div>
              <Show when={!a().vorbei}>
                <p class="text-muted-foreground">{m.monat_laeuft()}</p>
              </Show>
              <Show when={offen(a()) && a().abschliessbarAb}>
                {(ab) => (
                  <p class="text-muted-foreground">
                    {m.monat_abschliessbar_ab({ zeit: zeitpunktText(ab()) })}
                  </p>
                )}
              </Show>
              <Show when={a().offeneTage.length > 0}>
                <p class="text-warning">
                  {m.monat_offene_tage({ tage: tageText(a().offeneTage) })}
                </p>
              </Show>
              <Show when={a().ausgesondert} fallback={<Inhalt ansicht={a()} />}>
                {(ausgesondert) => (
                  <p class="text-muted-foreground">
                    {m.monat_ausgesondert_text({
                      abgeschlossen: datumText(ausgesondert().abgeschlossenAm),
                      datum: datumText(ausgesondert().am),
                      jahre: ausgesondert().jahre,
                    })}
                  </p>
                )}
              </Show>
              <Show when={dialog() === "ohne"}>
                <OhneBestaetigungDialog
                  monat={a().monat}
                  nutzerId={a().nutzerId}
                  name={a().name}
                  onSchliessen={() => setDialog(null)}
                  onGespeichert={q.nachSchritt}
                />
              </Show>
              <Show when={dialog() === "gegeneintrag"}>
                <GegeneintragDialog
                  monat={a().monat}
                  nutzerId={a().nutzerId}
                  onSchliessen={() => setDialog(null)}
                  onGespeichert={() => q.setMeldung(m.monat_gegeneintrag_gespeichert())}
                />
              </Show>
            </>
          )}
        </Show>
      </Loading>
    </Seite>
  );
};

export const Route = createFileRoute("/monat")({ component: MonatSeite });

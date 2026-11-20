import { Button } from "@soll/ui";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { knopfLink } from "../einrichtung/stil.ts";
import { Auswahl } from "../monat/auswahl.tsx";
import { GegeneintragDialog, OhneBestaetigungDialog } from "../monat/dialoge.tsx";
import { Pruefwert } from "../monat/pruefwert.tsx";
import { monatQuelle } from "../monat/quelle.ts";
import { Stand } from "../monat/stand.tsx";
import { Gegeneintraege, Summen, TageTabelle } from "../monat/tabelle.tsx";
import { monatText, tageText } from "../monat/text.ts";
import type { MonatAnsicht } from "../monat/typen.ts";
import { zeilenDesMonats } from "../monat/zeilen.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Seite } from "../rahmen/seite.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";

const hatRolle = (...rollen: string[]) =>
  (aktuellerBetrieb()?.rolle ?? "").split(",").some((rolle) => rollen.includes(rolle.trim()));

/** A month that has ended and is not closed yet */
const offen = (a: MonatAnsicht) => a.vorbei && a.abschluss === null;

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
  return (
    <div class="flex flex-wrap gap-2">
      <a
        href={`/api/v1/arbeitszeit/monat/stundenzettel?${props.abfrage}`}
        download
        class={knopfLink}
      >
        {m.monat_stundenzettel()}
      </a>
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

/**
 * Monatsabschluss (S-306): the days of a month with Soll and Ist, confirmed by the person and closed
 * by the owner, the time sheet as PDF and the Prüfwert (design/mockup/Monatsabschluss.dc.html)
 */
const MonatSeite = () => {
  const q = monatQuelle();
  const [dialog, setDialog] = createSignal<"ohne" | "gegeneintrag" | null>(null);
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
        q.ansicht()
          ? m.monat_titel_person({ monat: monatText(q.monat()), name: q.ansicht()?.name ?? "" })
          : m.monat_titel()
      }
    >
      <Auswahl
        personen={q.personen()}
        nutzerId={q.nutzerId() ?? q.ansicht()?.nutzerId}
        monat={q.monat()}
        onPerson={q.setNutzerId}
        onMonat={q.setMonat}
      />
      <Fehler text={q.fehler()} />
      <Show when={q.meldung()}>
        <p role="status">{q.meldung()}</p>
      </Show>
      <Show when={q.ansicht()}>
        {(a) => (
          <>
            <div class="flex flex-wrap items-center justify-between gap-3">
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
            <Show when={a().offeneTage.length > 0}>
              <p class="text-warning">{m.monat_offene_tage({ tage: tageText(a().offeneTage) })}</p>
            </Show>
            <Summen inhalt={a().inhalt} />
            <TageTabelle
              zeilen={zeilenDesMonats(
                a().inhalt.tage,
                a().inhalt.befunde,
                a().geaenderteTage,
                a().abschluss?.am ?? Date.now(),
              )}
            />
            <Gegeneintraege eintraege={a().inhalt.gegeneintraege} />
            <Pruefwert
              name={a().name}
              pruefwert={a().abschluss?.pruefwert ?? null}
              betriebId={aktuellerBetrieb()?.betriebId ?? ""}
            />
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
    </Seite>
  );
};

export const Route = createFileRoute("/monat")({ component: MonatSeite });

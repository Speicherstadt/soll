import { Button, Icon } from "@soll/ui";
import { LogIn, LogOut, Pause, Play, Plus } from "lucide";
import { createSignal, Loading, Show } from "solid-js";
import { AbgelehntListe, LueckenKarte, WartendKarte } from "../offline/hinweise.tsx";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { type Aktion, aktionenFuer } from "./aktionen.ts";
import { AusblickKarte, BefundListe } from "./befunde.tsx";
import { heuteStempeln } from "./heute.ts";
import { type Korrektur, KorrekturDialog } from "./korrektur.tsx";
import { LaufenderTag } from "./laufenderTag.tsx";
import { AenderungListe, StempelListe } from "./stempelListe.tsx";
import { tagText } from "./text.ts";

const NAMEN: Record<Aktion["name"], () => string> = {
  kommen: () => m.stempeln_kommen(),
  gehen: () => m.stempeln_gehen(),
  pause_starten: () => m.stempeln_pause_starten(),
  pause_beenden: () => m.stempeln_pause_beenden(),
};

const ICONS = { kommen: LogIn, gehen: LogOut, pause_starten: Pause, pause_beenden: Play };

/**
 * Heute with working time (design/mockup/Main.dc.html): the running day, the next finding, the big
 * button for the next step and Gehen beside it, the stamps of the day with their corrections; what
 * waits in the device's offline queue, what the server refused, and gaps in a device's numbers
 */
export const Stempeln = () => {
  const { quelle, schlange, fehler, arbeitet, stempeln } = heuteStempeln();
  const [korrektur, setKorrektur] = createSignal<Korrektur | null>(null);
  const aktionen = () => aktionenFuer(quelle.stand()?.zustand ?? "aus");
  return (
    <Loading>
      <Show
        when={quelle.ansicht()}
        fallback={<Fehler text={quelle.fehler() ? m.laden_fehler() : ""} />}
      >
        {(ansicht) => (
          <div class="flex min-w-0 flex-col gap-4">
            <p class="-mt-4 text-[15px] text-muted-foreground">{tagText(ansicht().tag)}</p>
            <WartendKarte
              anzahl={schlange.wartende().length}
              ohneNetz={quelle.ohneNetz() || schlange.ohneNetz()}
            />
            <LueckenKarte luecken={ansicht().luecken} />
            <Show when={quelle.stand()}>
              {(stand) => (
                <>
                  <LaufenderTag stand={stand()} sollMinuten={ansicht().sollMinuten} />
                  <Show when={stand().ausblick}>
                    {(ausblick) => <AusblickKarte ausblick={ausblick()} />}
                  </Show>
                  <Show when={stand().befunde.length > 0 || stand().nichtHinterlegt}>
                    <BefundListe
                      befunde={stand().befunde}
                      nichtHinterlegt={stand().nichtHinterlegt}
                      laufend={stand().zustand !== "aus"}
                    />
                  </Show>
                </>
              )}
            </Show>
            <Button
              class="h-[72px] rounded-xl text-[20px]"
              aria-pressed={
                aktionen().haupt.name.startsWith("pause")
                  ? (String(quelle.stand()?.zustand === "pause") as "true" | "false")
                  : undefined
              }
              disabled={arbeitet()}
              onClick={() => stempeln(aktionen().haupt.art)}
            >
              <Icon icon={ICONS[aktionen().haupt.name]} size={22} />
              {NAMEN[aktionen().haupt.name]()}
            </Button>
            <Show when={aktionen().neben}>
              {(neben) => (
                <Button
                  variant="outline"
                  class="h-[52px] rounded-xl text-[16px]"
                  disabled={arbeitet()}
                  onClick={() => stempeln(neben().art)}
                >
                  <Icon icon={ICONS[neben().name]} size={20} />
                  {NAMEN[neben().name]()}
                </Button>
              )}
            </Show>
            <Fehler text={fehler()} />
            <AbgelehntListe eintraege={schlange.abgelehnte()} />
            <StempelListe
              stempelungen={ansicht().stempelungen}
              darfKorrigieren
              onAendern={(stempel) => setKorrektur({ modus: "aendern", stempel })}
              onEntfernen={(stempel) => setKorrektur({ modus: "entfernen", stempel })}
            />
            <Button
              variant="outline"
              class="self-start"
              onClick={() =>
                setKorrektur({
                  modus: "nachtragen",
                  tag: ansicht().tag,
                  nutzerId: ansicht().nutzerId,
                })
              }
            >
              <Icon icon={Plus} />
              {m.nachtragen()}
            </Button>
            <AenderungListe aenderungen={ansicht().aenderungen} />
            <Show when={korrektur()}>
              {(aktuell) => (
                <KorrekturDialog korrektur={aktuell()} onSchliessen={() => setKorrektur(null)} />
              )}
            </Show>
          </div>
        )}
      </Show>
    </Loading>
  );
};

import { tagInBerlin } from "@soll/arbeitszeit";
import { createMemo, createSignal, createUniqueId, Loading, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import type { ProjektQuelle } from "../projekte/quelle.ts";
import { Fehler } from "../rahmen/karte.tsx";
import { NachweisListe } from "./liste.tsx";
import { nachweisQuelle } from "./quelle.ts";
import type { NachweisKopf, NachweisWahl } from "./typen.ts";
import { Unterschreiben } from "./unterschreiben.tsx";
import { VorschauTabelle } from "./vorschau.tsx";
import { NachweisWahlFelder, type WahlFelder } from "./wahl.tsx";

/**
 * The Stundennachweis (S-605) under Projekte: choose order and days, show the customer the bookings,
 * let them sign on the phone, then download or share the PDF
 */
export const Stundennachweise = (props: { projekte: ProjektQuelle }) => {
  const id = createUniqueId();
  const heute = tagInBerlin(Date.now());
  const [felder, setFelder] = createSignal<WahlFelder>({
    projektId: "",
    von: heute,
    bis: heute,
    nutzerId: "",
  });
  const [fertig, setFertig] = createSignal<NachweisKopf | null>(null);
  const projekte = () => props.projekte.projekte().filter((p) => p.archiviertAm === null);
  const werte = createMemo(() => ({
    ...felder(),
    projektId: felder().projektId || (projekte()[0]?.projektId ?? ""),
  }));
  const wahl = createMemo((): NachweisWahl | null => {
    const { projektId, von, bis, nutzerId } = werte();
    if (!projektId || !von || !bis) return null;
    return nutzerId ? { projektId, von, bis, nutzerId } : { projektId, von, bis };
  });
  const quelle = nachweisQuelle(wahl);
  return (
    <div class="flex flex-col gap-8">
      <section aria-labelledby={`${id}-neu`} class="flex max-w-3xl flex-col gap-4">
        <h2 id={`${id}-neu`} class="font-semibold text-[17px]">
          {m.nachweis_neu()}
        </h2>
        <Show
          when={projekte().length > 0}
          fallback={<p class="text-muted-foreground">{m.nachweis_kein_auftrag()}</p>}
        >
          <NachweisWahlFelder
            werte={werte()}
            projekte={projekte()}
            personen={props.projekte.personen()}
            verwalten={props.projekte.verwalten}
            onAendern={(neu) => {
              setFertig(null);
              setFelder((alt) => ({ ...alt, ...neu }));
            }}
          />
          <Show when={fertig()}>
            {(nachweis) => (
              <p role="status" class="rounded-md border border-border bg-muted px-3 py-2">
                {m.nachweis_unterschrieben({ nummer: String(nachweis().nummer) })}
              </p>
            )}
          </Show>
          <Loading>
            <Fehler text={quelle.fehler() ? m.laden_fehler() : ""} />
            <Show when={quelle.vorschau()}>
              {(vorschau) => (
                <>
                  <VorschauTabelle vorschau={vorschau()} />
                  <Show when={vorschau().zeilen.length > 0 && wahl()}>
                    {(gewaehlt) => (
                      <Unterschreiben
                        wahl={gewaehlt()}
                        vorschau={vorschau()}
                        onUnterschrieben={setFertig}
                      />
                    )}
                  </Show>
                </>
              )}
            </Show>
          </Loading>
        </Show>
      </section>
      <section aria-labelledby={`${id}-liste`} class="flex flex-col gap-3">
        <h2 id={`${id}-liste`} class="font-semibold text-[17px]">
          {m.nachweis_liste()}
        </h2>
        <NachweisListe nachweise={quelle.nachweise()} />
      </section>
    </div>
  );
};

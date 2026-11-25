import { Button, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { createSignal, For, Show } from "solid-js";
import { knopfLink } from "../einrichtung/stil.ts";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { datumText } from "../projekte/werte.ts";
import { Fehler } from "../rahmen/karte.tsx";
import { zeitpunktText } from "../zeiten/text.ts";
import { pdfPfad } from "./quelle.ts";
import type { NachweisKopf } from "./typen.ts";

/** The file name the server gives the PDF (content-disposition), so the app names no file itself */
const dateiname = (antwort: Response): string =>
  /filename="([^"]+)"/.exec(antwort.headers.get("content-disposition") ?? "")?.[1] ?? "";

/** Whether the device can hand a file to another app (Web Share API with files) */
const kannTeilen = () =>
  typeof navigator.canShare === "function" &&
  navigator.canShare({ files: [new File([], "x.pdf", { type: "application/pdf" })] });

/**
 * Hands the PDF to another app of the device (mail, messenger) for the customer: no public link, the
 * file goes from the device (docs/plan.md, "Stundennachweis an den Kunden")
 */
const teilen = async (nachweis: NachweisKopf): Promise<boolean> => {
  try {
    const antwort = await fetch(pdfPfad(nachweis.nachweisId), { credentials: "same-origin" });
    if (!antwort.ok) return false;
    const datei = new File([await antwort.blob()], dateiname(antwort), {
      type: "application/pdf",
    });
    await navigator.share({
      files: [datei],
      title: m.nachweis_titel({ nummer: String(nachweis.nummer) }),
    });
    return true;
  } catch (fehler) {
    // the person closed the share sheet: nothing went wrong
    return fehler instanceof DOMException && fehler.name === "AbortError";
  }
};

/** The signed reports: number, order, span, hours, who signed when; the PDF to download or share */
export const NachweisListe = (props: { nachweise: NachweisKopf[] }) => {
  const [fehler, setFehler] = createSignal("");
  const teilenMoeglich = kannTeilen();
  return (
    <div class="flex flex-col gap-3">
      <Show
        when={props.nachweise.length > 0}
        fallback={<p class="text-muted-foreground">{m.nachweis_liste_leer()}</p>}
      >
        <Table beschriftung={m.nachweis_liste()}>
          <Thead>
            <Tr>
              <Th>{m.nachweis_spalte_nachweis()}</Th>
              <Th class="text-end">{m.nachweis_spalte_dauer()}</Th>
              <Th>
                <span class="sr-only">{m.spalte_aktionen()}</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            <For each={props.nachweise}>
              {(nachweis) => (
                <Tr>
                  <Td class="py-1.5">
                    <span class="block font-medium">
                      {`${m.nachweis_titel({ nummer: String(nachweis.nummer) })} · ${nachweis.auftrag}`}
                    </span>
                    <span class="block text-[12px] text-muted-foreground">
                      {`${nachweis.kunde} · ${m.nachweis_zeitraum({ von: datumText(nachweis.von), bis: datumText(nachweis.bis) })}`}
                    </span>
                    <span class="block text-[12px] text-muted-foreground">
                      {m.nachweis_zeile_unterschrieben({
                        name: nachweis.unterzeichner,
                        zeit: zeitpunktText(nachweis.unterschriebenAm),
                      })}
                    </span>
                  </Td>
                  <Td class="py-1.5 text-end tabular-nums">{dauerText(nachweis.summeMinuten)}</Td>
                  <Td class="py-1.5">
                    <div class="flex justify-end gap-2">
                      <a
                        class={knopfLink}
                        href={pdfPfad(nachweis.nachweisId)}
                        download
                        aria-label={m.nachweis_pdf({ nummer: String(nachweis.nummer) })}
                      >
                        {m.nachweis_pdf_kurz()}
                      </a>
                      <Show when={teilenMoeglich}>
                        <Button
                          variant="outline"
                          aria-label={m.nachweis_teilen({ nummer: String(nachweis.nummer) })}
                          onClick={async () =>
                            setFehler((await teilen(nachweis)) ? "" : m.nachweis_teilen_fehler())
                          }
                        >
                          {m.nachweis_teilen_kurz()}
                        </Button>
                      </Show>
                    </div>
                  </Td>
                </Tr>
              )}
            </For>
          </Tbody>
        </Table>
      </Show>
      <Fehler text={fehler()} />
    </div>
  );
};

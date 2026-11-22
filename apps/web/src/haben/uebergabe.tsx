import { tagInBerlin } from "@soll/arbeitszeit";
import { Badge, Button, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { createMemo, createSignal, For, Loading, Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import type { Projekt } from "../projekte/typen.ts";
import { datumText } from "../projekte/werte.ts";
import { Fehler } from "../rahmen/karte.tsx";
import { NachweisWahlFelder, type WahlFelder } from "../stundennachweis/wahl.tsx";
import { uhrzeitText } from "../zeiten/text.ts";
import { HOECHSTENS, uebergabeQuelle, uebergeben } from "./quelle.ts";
import { habenFehler, standText } from "./text.ts";
import type { UebergabeZeile } from "./typen.ts";

/** What still has to go: not billed yet, or billed for Haben and not confirmed by it */
const ausstehend = (zeilen: UebergabeZeile[]) =>
  zeilen.filter((z) => z.stand === "offen" || z.stand === "wartet");

/** The bookings of the order, each with its state under the activity; a refusal of Haben with its own words */
const Liste = (props: { zeilen: UebergabeZeile[] }) => (
  <Show
    when={props.zeilen.length > 0}
    fallback={<p class="text-muted-foreground">{m.haben_buchungen_leer()}</p>}
  >
    <Table beschriftung={m.haben_buchungen()}>
      <Thead>
        <Tr>
          <Th>{m.nachweis_spalte_tag()}</Th>
          <Th>{m.nachweis_spalte_zeit()}</Th>
          <Th>{m.nachweis_spalte_taetigkeit()}</Th>
          <Th class="text-end">{m.nachweis_spalte_dauer()}</Th>
        </Tr>
      </Thead>
      <Tbody>
        <For each={props.zeilen}>
          {(zeile) => (
            <Tr>
              <Td class="py-1.5">
                <span class="block">{datumText(zeile.tag)}</span>
                <span class="block text-[12px] text-muted-foreground">{zeile.person}</span>
              </Td>
              <Td class="py-1.5 tabular-nums">
                {`${uhrzeitText(zeile.beginn)}–${uhrzeitText(zeile.ende)}`}
              </Td>
              <Td class="py-1.5">
                <span class="block">{zeile.taetigkeit}</span>
                <Show when={zeile.notiz}>
                  <span class="block text-[12px] text-muted-foreground">{zeile.notiz}</span>
                </Show>
                <span class="mt-1 block">
                  <Badge>{standText(zeile.stand)}</Badge>
                </span>
                <Show when={zeile.fehler}>
                  {(fehler) => (
                    <span class="block text-[12px] text-danger">
                      {zeile.meldung
                        ? `${habenFehler(fehler())} ${zeile.meldung}`
                        : habenFehler(fehler())}
                    </span>
                  )}
                </Show>
              </Td>
              <Td class="py-1.5 text-end tabular-nums">{dauerText(zeile.minuten)}</Td>
            </Tr>
          )}
        </For>
      </Tbody>
    </Table>
  </Show>
);

/**
 * The transfer to Haben (S-606): choose order and days, see each booking's state, hand over what is
 * still open; the bookings are billed and locked by it
 */
export const Uebergabe = (props: { projekte: Projekt[] }) => {
  const heute = tagInBerlin(Date.now());
  const [felder, setFelder] = createSignal<WahlFelder>({
    projektId: "",
    von: `${heute.slice(0, 8)}01`,
    bis: heute,
    nutzerId: "",
  });
  const [ergebnis, setErgebnis] = createSignal({ text: "", fehler: "" });
  const werte = createMemo(() => ({
    ...felder(),
    projektId: felder().projektId || (props.projekte[0]?.projektId ?? ""),
  }));
  const wahl = createMemo(() => {
    const { projektId, von, bis } = werte();
    return projektId && von && bis ? { projektId, von, bis } : null;
  });
  const quelle = uebergabeQuelle(wahl);
  const senden = uebergeben();
  const uebergeben_ = async (zeilen: UebergabeZeile[]) => {
    const antwort = await senden.mutate(zeilen.slice(0, HOECHSTENS).map((z) => z.buchungId));
    if (!antwort.ok) return setErgebnis({ text: "", fehler: habenFehler(antwort.fehler) });
    const gesendet = antwort.daten.buchungen.filter((b) => b.stand === "gesendet").length;
    const wartet = antwort.daten.buchungen.length - gesendet;
    setErgebnis({
      text: m.haben_uebergeben_ergebnis({ gesendet: String(gesendet) }),
      fehler: wartet > 0 ? m.haben_uebergeben_wartet({ anzahl: String(wartet) }) : "",
    });
  };
  return (
    <div class="flex flex-col gap-4">
      <NachweisWahlFelder
        werte={werte()}
        projekte={props.projekte}
        personen={[]}
        verwalten={false}
        onAendern={(neu) => {
          setErgebnis({ text: "", fehler: "" });
          setFelder((alt) => ({ ...alt, ...neu }));
        }}
      />
      <Show when={ergebnis().text}>
        <p role="status" class="rounded-md border border-border bg-muted px-3 py-2">
          {ergebnis().text}
        </p>
      </Show>
      <Fehler text={ergebnis().fehler} />
      <Loading>
        <Fehler text={quelle.fehler() ? m.laden_fehler() : ""} />
        <Show when={quelle.liste()}>
          {(liste) => (
            <>
              <Show when={liste().kontaktId === null}>
                <p class="text-muted-foreground">{m.haben_fehler_kunde()}</p>
              </Show>
              <Liste zeilen={liste().buchungen} />
              <Show when={liste().kontaktId !== null && ausstehend(liste().buchungen).length > 0}>
                <Button
                  class="self-start"
                  disabled={senden.isPending}
                  onClick={() => uebergeben_(ausstehend(liste().buchungen))}
                >
                  {m.haben_uebergeben({
                    anzahl: String(Math.min(ausstehend(liste().buchungen).length, HOECHSTENS)),
                  })}
                </Button>
                <p class="text-[12px] text-muted-foreground">{m.haben_uebergeben_hinweis()}</p>
              </Show>
            </>
          )}
        </Show>
      </Loading>
    </div>
  );
};

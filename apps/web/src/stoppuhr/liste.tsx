import { Badge, Button, Icon, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { Pencil, Trash2 } from "lucide";
import { For, Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { uhrzeitText } from "../zeiten/text.ts";
import type { StoppuhrQuelle } from "./quelle.ts";
import { wahlText } from "./text.ts";
import type { Buchung } from "./typen.ts";

const zeitText = (buchung: Buchung) =>
  buchung.ende === null
    ? m.stoppuhr_seit({ uhrzeit: uhrzeitText(buchung.beginn) })
    : `${uhrzeitText(buchung.beginn)}–${uhrzeitText(buchung.ende)}`;

/** The reference to the stamps: the shift a booking falls in, or none */
const schichtText = (buchung: Buchung) =>
  buchung.kommen
    ? m.stoppuhr_schicht({ uhrzeit: uhrzeitText(buchung.kommen.zeitpunkt) })
    : m.stoppuhr_ohne_schicht();

/**
 * The bookings of a day: time, what they are on with the note and the shift they fall in, their
 * minutes; change and remove until a booking is billed
 */
export const BuchungListe = (props: {
  quelle: StoppuhrQuelle;
  buchungen: Buchung[];
  /** whether Soll records the person's working time, so the shift is named */
  mitSchicht: boolean;
  onAendern: (buchung: Buchung) => void;
  onEntfernen: (buchung: Buchung) => void;
}) => {
  const name = (buchung: Buchung) =>
    wahlText(props.quelle.projekte(), props.quelle.taetigkeiten(), buchung);
  return (
    <Table beschriftung={m.stoppuhr_buchungen()}>
      <Thead>
        <Tr>
          <Th>{m.stoppuhr_spalte_zeit()}</Th>
          <Th>{m.stoppuhr_spalte_buchung()}</Th>
          <Th>{m.stoppuhr_spalte_dauer()}</Th>
          <Th>
            <span class="sr-only">{m.spalte_aktionen()}</span>
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        <For each={props.buchungen}>
          {(buchung) => (
            <Tr>
              <Td class="whitespace-nowrap py-1.5">{zeitText(buchung)}</Td>
              <Td class="py-1.5">
                <span class="block">{name(buchung)}</span>
                <span class="block text-[12px] text-muted-foreground">
                  {[buchung.notiz, props.mitSchicht ? schichtText(buchung) : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Td>
              <Td class="py-1.5">{dauerText(buchung.minuten)}</Td>
              <Td>
                <Show
                  when={buchung.abgerechnetAm === null}
                  fallback={<Badge>{m.stoppuhr_abgerechnet()}</Badge>}
                >
                  <div class="flex justify-end gap-1">
                    <Button
                      variant="icon"
                      aria-label={m.buchung_aendern({ name: name(buchung) })}
                      onClick={() => props.onAendern(buchung)}
                    >
                      <Icon icon={Pencil} />
                    </Button>
                    <Button
                      variant="icon"
                      aria-label={m.entfernen({ name: name(buchung) })}
                      onClick={() => props.onEntfernen(buchung)}
                    >
                      <Icon icon={Trash2} />
                    </Button>
                  </div>
                </Show>
              </Td>
            </Tr>
          )}
        </For>
      </Tbody>
    </Table>
  );
};

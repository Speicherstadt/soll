import { Button, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Lesefehler } from "./datei.tsx";
import { ART_NAMEN, abgelehntText } from "./texte.ts";
import { PLAN_ARTEN, type PlanArt, type Probelauf, type Uebernahme } from "./typen.ts";

/** The kinds a result shows: bookings and activities only when there are any (S-702, S-705) */
const gezeigt = (probelauf: Probelauf): PlanArt[] =>
  PLAN_ARTEN.filter(
    (art) =>
      (art !== "buchungen" && art !== "taetigkeiten") ||
      Object.values(probelauf.zahlen[art] ?? {}).some((n) => n > 0),
  );

/** What the takeover creates, finds there already, leaves out and refuses, per kind */
const Zahlen = (props: { probelauf: Probelauf }) => (
  <Table beschriftung={m.umzug_tabelle()}>
    <Thead>
      <Tr>
        <Th>{m.umzug_spalte_was()}</Th>
        <Th>{m.umzug_neu()}</Th>
        <Th>{m.umzug_vorhanden()}</Th>
        <Th>{m.umzug_ausgelassen()}</Th>
        <Th>{m.umzug_abgelehnt()}</Th>
      </Tr>
    </Thead>
    <Tbody>
      <For each={gezeigt(props.probelauf)}>
        {(art) => (
          <Tr>
            <Td>{ART_NAMEN[art]()}</Td>
            <Td>{props.probelauf.zahlen[art].neu}</Td>
            <Td>{props.probelauf.zahlen[art].vorhanden}</Td>
            <Td>{props.probelauf.zahlen[art].ausgelassen}</Td>
            <Td>{props.probelauf.zahlen[art].abgelehnt}</Td>
          </Tr>
        )}
      </For>
    </Tbody>
  </Table>
);

const Abgelehnt = (props: { probelauf: Probelauf }) => (
  <Show when={props.probelauf.abgelehnt.anzahl > 0}>
    <section aria-labelledby="abgelehnt-titel" class="flex flex-col gap-1.5">
      <h3 id="abgelehnt-titel" class="font-semibold">
        {m.umzug_abgelehnt_titel({ anzahl: props.probelauf.abgelehnt.anzahl })}
      </h3>
      <ul class="flex max-h-60 flex-col gap-1 overflow-y-auto">
        <For each={props.probelauf.abgelehnt.liste}>
          {(a) => (
            <li>
              {ART_NAMEN[a.art]()} · {abgelehntText(a.zeile, a.grund)}
            </li>
          )}
        </For>
      </ul>
    </section>
  </Show>
);

/** The result of a dry run or of the takeover itself */
export const Ergebnis = (props: { probelauf: Probelauf }) => (
  <div class="flex flex-col gap-4">
    <Zahlen probelauf={props.probelauf} />
    <Show when={props.probelauf.monate.length > 0}>
      <p>{m.umzug_monate_sperren({ anzahl: props.probelauf.monate.length })}</p>
    </Show>
    <Abgelehnt probelauf={props.probelauf} />
    <Lesefehler fehler={props.probelauf.lesefehler} />
  </div>
);

/** Step 5: the dry run first, then the takeover, then what came of it */
export const UebernahmeSchritt = (props: {
  probelauf: Probelauf | null;
  uebernahme: Uebernahme | null;
  arbeitet: boolean;
  probieren: () => void;
  uebernehmen: () => void;
  neu: () => void;
}) => (
  <Show
    when={props.uebernahme}
    fallback={
      <div class="flex flex-col gap-4">
        <p class="text-muted-foreground">{m.umzug_probelauf_text()}</p>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" disabled={props.arbeitet} onClick={() => props.probieren()}>
            {m.umzug_probelauf()}
          </Button>
          <Show when={props.probelauf}>
            <Button disabled={props.arbeitet} onClick={() => props.uebernehmen()}>
              {m.umzug_uebernehmen()}
            </Button>
          </Show>
        </div>
        <Show when={props.probelauf}>{(probelauf) => <Ergebnis probelauf={probelauf()} />}</Show>
      </div>
    }
  >
    {(uebernahme) => (
      <div class="flex flex-col gap-4">
        <p role="status" class="break-all">
          {m.umzug_fertig({ sha256: uebernahme().dateiSha256 })}
        </p>
        <Show when={uebernahme().nichtGesperrt.length > 0}>
          <p>{m.umzug_nicht_gesperrt({ anzahl: uebernahme().nichtGesperrt.length })}</p>
        </Show>
        <Ergebnis probelauf={uebernahme()} />
        <Button variant="outline" class="self-start" onClick={() => props.neu()}>
          {m.umzug_neu_beginnen()}
        </Button>
      </div>
    )}
  </Show>
);

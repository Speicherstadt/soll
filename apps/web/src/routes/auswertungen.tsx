import { createFileRoute } from "@tanstack/solid-router";
import { Loading, Show } from "solid-js";
import { abfrage } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { AuslastungBereich, jePersonAn, verwaltet } from "../auslastung/auslastung.tsx";
import { DatevExport } from "../datev/export.tsx";
import type { DatevAnsicht } from "../datev/typen.ts";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";
import { aktuelleModule } from "../sitzung/sitzung.ts";

/** Whether the utilisation has anything for the person (S-604); the server decides again */
const mitAuslastung = () => aktuelleModule().projektzeit && (verwaltet() || jePersonAn());

/**
 * Evaluations and exports: the utilisation of project time (S-604) and the DATEV payroll export
 * for owner and payroll (S-308); the server refuses each to whoever may not see it
 */
const Auswertungen = () => {
  const datev = abfrage<DatevAnsicht>(ressourcen.datev);
  return (
    <Seite titel={m.nav_auswertungen()}>
      <Show when={mitAuslastung()}>
        <AuslastungBereich />
      </Show>
      <Loading>
        <Show
          when={datev.data?.ok}
          fallback={
            <Show when={!mitAuslastung()}>
              <Leer text={m.seite_leer()} />
            </Show>
          }
        >
          <DatevExport />
        </Show>
      </Loading>
    </Seite>
  );
};

export const Route = createFileRoute("/auswertungen")({ component: Auswertungen });

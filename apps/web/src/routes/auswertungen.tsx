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
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-stretch">
        <Show when={mitAuslastung()}>
          <div class={datev.data?.ok ? "min-w-0 xl:col-span-7" : "min-w-0 xl:col-span-12"}>
            <AuslastungBereich />
          </div>
        </Show>
        <Loading>
          <Show
            when={datev.data?.ok}
            fallback={
              <Show when={!mitAuslastung()}>
                <div class="xl:col-span-12">
                  <Leer text={m.seite_leer()} />
                </div>
              </Show>
            }
          >
            <div class={mitAuslastung() ? "min-w-0 xl:col-span-5" : "min-w-0 xl:col-span-12"}>
              <DatevExport />
            </div>
          </Show>
        </Loading>
      </div>
    </Seite>
  );
};

export const Route = createFileRoute("/auswertungen")({ component: Auswertungen });

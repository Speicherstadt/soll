import { createFileRoute } from "@tanstack/solid-router";
import { Loading, Show } from "solid-js";
import { abfrage } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { DatevExport } from "../datev/export.tsx";
import type { DatevAnsicht } from "../datev/typen.ts";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";

/**
 * Evaluations and exports: the DATEV payroll export for owner and payroll (S-308); the server
 * refuses its settings to everyone else, and the page stays empty for them
 */
const Auswertungen = () => {
  const datev = abfrage<DatevAnsicht>(ressourcen.datev);
  return (
    <Seite titel={m.nav_auswertungen()}>
      <Loading>
        <Show when={datev.data?.ok} fallback={<Leer text={m.seite_leer()} />}>
          <DatevExport />
        </Show>
      </Loading>
    </Seite>
  );
};

export const Route = createFileRoute("/auswertungen")({ component: Auswertungen });

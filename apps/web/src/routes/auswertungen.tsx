import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { DatevExport } from "../datev/export.tsx";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";

/** Evaluations and exports: the DATEV payroll export for owner and payroll (S-308) */
const Auswertungen = () => {
  const [mitExport, setMitExport] = createSignal<boolean | null>(null);
  return (
    <Seite titel={m.nav_auswertungen()}>
      <DatevExport onSichtbar={setMitExport} />
      <Show when={mitExport() === false}>
        <Leer text={m.seite_leer()} />
      </Show>
    </Seite>
  );
};

export const Route = createFileRoute("/auswertungen")({ component: Auswertungen });

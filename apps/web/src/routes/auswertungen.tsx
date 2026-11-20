import { createFileRoute } from "@tanstack/solid-router";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";

const Auswertungen = () => (
  <Seite titel={m.nav_auswertungen()}>
    <Leer text={m.seite_leer()} />
  </Seite>
);

export const Route = createFileRoute("/auswertungen")({ component: Auswertungen });

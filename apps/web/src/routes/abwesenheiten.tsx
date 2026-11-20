import { createFileRoute } from "@tanstack/solid-router";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";

const Abwesenheiten = () => (
  <Seite titel={m.nav_abwesenheiten()}>
    <Leer text={m.seite_leer()} />
  </Seite>
);

export const Route = createFileRoute("/abwesenheiten")({ component: Abwesenheiten });

import { createFileRoute } from "@tanstack/solid-router";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";

const Dienstplan = () => (
  <Seite titel={m.nav_dienstplan()}>
    <Leer text={m.seite_leer()} />
  </Seite>
);

export const Route = createFileRoute("/dienstplan")({ component: Dienstplan });

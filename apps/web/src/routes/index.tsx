import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";
import { aktuelleModule, aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { Stoppuhr } from "../stoppuhr/stoppuhr.tsx";
import { Stempeln } from "../zeiten/stempeln.tsx";

/** Whoever books project time: every role but a device (rollen.ts on the server, "projekte:lesen") */
const buchtProjektzeit = () =>
  (aktuellerBetrieb()?.rolle ?? "")
    .split(",")
    .some((rolle) => rolle.trim() !== "" && rolle.trim() !== "geraet");

/**
 * Heute: the stamp button and the running day with working time, the stopwatch with project time
 * (S-602); without working time (a business without employees, S-603) the page says so
 */
const Heute = () => {
  const stoppuhr = () => aktuelleModule().projektzeit && buchtProjektzeit();
  return (
    <Seite titel={m.nav_heute()}>
      <Show
        when={aktuelleModule().arbeitszeit}
        fallback={<Leer text={m.heute_ohne_arbeitszeit()} />}
      >
        <Stempeln />
      </Show>
      <Show when={stoppuhr()}>
        <Stoppuhr />
      </Show>
    </Seite>
  );
};

export const Route = createFileRoute("/")({ component: Heute });

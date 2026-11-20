import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { Auskunft } from "../export/auskunft.tsx";
import { Pruefexport } from "../export/pruefexport.tsx";
import { m } from "../paraglide/messages.js";
import { Seite } from "../rahmen/seite.tsx";
import { aktuelleModule, aktuellerBetrieb } from "../sitzung/sitzung.ts";

/** Roles that stamp, or see all times: they have days to export (external staff and devices not) */
const MIT_ZEITEN = ["inhaber", "planer", "mitarbeiter", "lohnbuero", "betriebsrat"];
const hatZeiten = () =>
  (aktuellerBetrieb()?.rolle ?? "").split(",").some((rolle) => MIT_ZEITEN.includes(rolle.trim()));

/**
 * Prüfexport and Auskunft (S-309): the times for an authority, while the business uses working time
 * (its routes are refused otherwise), and one's own data under Art. 15 DSGVO, always
 */
const Export = () => (
  <Seite titel={m.export_titel()}>
    <Show when={aktuelleModule().arbeitszeit && hatZeiten()}>
      <Pruefexport />
    </Show>
    <Auskunft />
  </Seite>
);

export const Route = createFileRoute("/export")({ component: Export });

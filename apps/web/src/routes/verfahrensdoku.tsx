import { createFileRoute } from "@tanstack/solid-router";
import { Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Leer, Seite } from "../rahmen/seite.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";
import { AngabenFormular } from "../verfahrensdoku/angaben.tsx";
import { DokumentAnsicht, DokumentKopf } from "../verfahrensdoku/dokument.tsx";
import type { VerfahrensdokuAnsicht } from "../verfahrensdoku/typen.ts";

/**
 * The Verfahrensdokumentation of the business (S-902): its state and downloads, the statements only
 * the owner can make, and the document as the downloads carry it. Only the owner sees it; the
 * server refuses everyone else.
 */
const Inhalt = () => {
  const abgefragt = abfrage<VerfahrensdokuAnsicht>(ressourcen.verfahrensdoku);
  const ansicht = () => daten(abgefragt.data);
  const fehler = () => {
    const antwort = abgefragt.data;
    if (antwort?.ok !== false) return "";
    return antwort.status === 0 ? m.fehler_netz() : m.verfahrensdoku_fehler_laden();
  };
  return (
    <Loading>
      <Fehler text={fehler()} />
      <Show when={ansicht()}>
        {(a) => (
          <>
            <DokumentKopf dokument={a().dokument} />
            <AngabenFormular angaben={a().angaben} />
            <DokumentAnsicht dokument={a().dokument} />
          </>
        )}
      </Show>
    </Loading>
  );
};

const Verfahrensdoku = () => {
  const inhaber = () => {
    const betrieb = aktuellerBetrieb();
    return betrieb ? istInhaber(betrieb) : false;
  };
  return (
    <Seite titel={m.verfahrensdoku_titel()}>
      <Show when={inhaber()} fallback={<Leer text={m.verfahrensdoku_nur_inhaber()} />}>
        <Inhalt />
      </Show>
    </Seite>
  );
};

export const Route = createFileRoute("/verfahrensdoku")({ component: Verfahrensdoku });

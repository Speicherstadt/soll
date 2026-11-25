import type { JSX } from "@solidjs/web";
import { createUniqueId, Loading, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import type { ProjektQuelle } from "../projekte/quelle.ts";
import { Fehler } from "../rahmen/karte.tsx";
import { KontaktListe } from "./kontakte.tsx";
import { habenQuelle } from "./quelle.ts";
import { Uebergabe } from "./uebergabe.tsx";
import { ZugangFormular } from "./zugang.tsx";

const Abschnitt = (props: { titel: string; text?: string; children: JSX.Element }) => {
  const id = createUniqueId();
  return (
    <section aria-labelledby={id} class="flex flex-col gap-3">
      <h2 id={id} class="font-semibold text-[17px]">
        {props.titel}
      </h2>
      <Show when={props.text}>
        <p class="max-w-3xl text-muted-foreground">{props.text}</p>
      </Show>
      {props.children}
    </section>
  );
};

/**
 * Haben under Projekte (S-606), for owner and planner: the access, the customers linked with
 * contacts of Haben, and the transfer of bookings as Leistungen
 */
export const Haben = (props: { projekte: ProjektQuelle; inhaber: boolean }) => {
  const quelle = habenQuelle();
  const aktive = () => props.projekte.projekte().filter((p) => p.archiviertAm === null);
  return (
    <div class="flex flex-col gap-8">
      <Loading>
        <Fehler text={quelle.zugangFehler() ? m.laden_fehler() : ""} />
        <Abschnitt titel={m.haben_zugang()} text={m.haben_zugang_text()}>
          <ZugangFormular zugang={quelle.zugang()} inhaber={props.inhaber} />
        </Abschnitt>
        <Show when={quelle.zugang()}>
          <Abschnitt titel={m.haben_kontakte()} text={m.haben_kontakte_text()}>
            <Loading>
              <KontaktListe kunden={props.projekte.kunden()} />
            </Loading>
          </Abschnitt>
          <Abschnitt titel={m.haben_uebergabe()} text={m.haben_uebergabe_text()}>
            <Show
              when={aktive().length > 0}
              fallback={<p class="text-muted-foreground">{m.haben_kein_auftrag()}</p>}
            >
              <Uebergabe projekte={aktive()} />
            </Show>
          </Abschnitt>
        </Show>
      </Loading>
    </div>
  );
};

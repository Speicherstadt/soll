import type { Stempelart } from "@soll/arbeitszeit";
import { Button, Icon } from "@soll/ui";
import { Cloud, CloudOff, CloudUpload, LogIn, LogOut, Pause } from "lucide";
import { For, Show } from "solid-js";
import { m } from "../../paraglide/messages.js";
import { ART_NAMEN, uhrzeitText } from "../../zeiten/text.ts";
import { sekundenBis } from "../eingabe.ts";

/**
 * What the kiosk shows without a network (S-803): the state of the queue on the clock's side, the
 * choice without the person's state, and the stamp kept on the tablet
 */

const Zurueck = (props: { bis: number; jetzt: number }) => (
  <span class="text-[15px] text-muted-foreground">
    {m.kiosk_zurueck({ sekunden: sekundenBis(props.bis, props.jetzt) })}
  </span>
);

/** Kommen, Pause and Gehen; after a break the person taps Kommen (docs/plan.md, R-01) */
const KNOEPFE = [
  { art: "kommen", name: () => m.stempeln_kommen(), icon: LogIn },
  { art: "pause_beginn", name: () => m.stempeln_pause_starten(), icon: Pause },
  { art: "gehen", name: () => m.stempeln_gehen(), icon: LogOut },
] as const;

/**
 * Credential given, no network: nobody but the server knows who it is, so the person sees no name
 * and no state, only the three buttons; Soll never stamps by itself
 */
export const OhneNetzAnsicht = (props: {
  bis: number;
  jetzt: number;
  beschaeftigt: boolean;
  onStempeln: (art: Stempelart) => void;
  onFertig: () => void;
}) => (
  <section aria-label={m.kiosk_offline_titel()} class="flex flex-col justify-center gap-7 p-16">
    <div class="flex flex-col gap-3">
      <h2 class="font-bold text-[40px] tracking-tight">{m.kiosk_offline_titel()}</h2>
      <p class="text-[22px] text-muted-foreground">{m.kiosk_offline_text()}</p>
    </div>
    <div class="flex gap-4">
      <For each={KNOEPFE}>
        {(knopf) => (
          <Button
            variant={knopf.art === "kommen" ? "primary" : "outline"}
            disabled={props.beschaeftigt}
            class="h-24 flex-1 rounded-2xl text-[24px]"
            onClick={() => props.onStempeln(knopf.art)}
          >
            <Icon icon={knopf.icon} size={28} />
            {knopf.name()}
          </Button>
        )}
      </For>
    </div>
    <p class="text-[17px] text-muted-foreground">{m.kiosk_offline_pause()}</p>
    <div class="flex items-center justify-between">
      <Zurueck bis={props.bis} jetzt={props.jetzt} />
      <Button variant="ghost" class="h-16 px-6 text-[18px]" onClick={props.onFertig}>
        {m.kiosk_fertig()}
      </Button>
    </div>
  </section>
);

/** The stamp kept on the tablet, back to the clock after 5 seconds like a stamp sent */
export const GespeichertAnsicht = (props: {
  stempelart: Stempelart;
  zeitpunkt: number;
  bis: number;
  jetzt: number;
}) => (
  <section
    role="status"
    aria-label={m.kiosk_gespeichert()}
    class="flex flex-col justify-center gap-7 p-16"
  >
    <div class="flex size-[88px] items-center justify-center rounded-full bg-muted">
      <Icon icon={CloudUpload} size={48} />
    </div>
    <div class="flex flex-col gap-2">
      <h2 class="font-bold text-[40px] tracking-tight">
        {m.kiosk_gespeichert_um({
          art: ART_NAMEN[props.stempelart](),
          uhrzeit: uhrzeitText(props.zeitpunkt),
        })}
      </h2>
      <p class="text-[22px] text-muted-foreground">{m.kiosk_gespeichert_text()}</p>
    </div>
    <Zurueck bis={props.bis} jetzt={props.jetzt} />
  </section>
);

/** On the clock's side: online or not, how many stamps wait, when the last went out */
export const NetzStand = (props: {
  ohneNetz: boolean;
  wartend: number;
  zuletzt: number | null;
}) => (
  <div data-testid="netz" class="flex flex-col gap-1 text-[17px]">
    <span class="flex items-center gap-2">
      <Icon icon={props.ohneNetz ? CloudOff : Cloud} size={20} />
      {props.ohneNetz ? m.kiosk_netz_aus() : m.kiosk_netz_an()}
    </span>
    <Show when={props.wartend > 0}>
      <span data-testid="wartend">{m.kiosk_wartend({ anzahl: props.wartend })}</span>
    </Show>
    <Show when={props.zuletzt}>
      {(zuletzt) => (
        <span class="text-muted-foreground">
          {m.kiosk_zuletzt({ uhrzeit: uhrzeitText(zuletzt()) })}
        </span>
      )}
    </Show>
  </div>
);

import type { Stempelart, Tagesstand } from "@soll/arbeitszeit";
import { Button, Icon } from "@soll/ui";
import { Check, LogIn, LogOut, Pause, Play } from "lucide";
import { Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { type Aktion, aktionenFuer } from "../zeiten/aktionen.ts";
import { AusblickKarte } from "../zeiten/befunde.tsx";
import { ART_NAMEN, uhrzeitText } from "../zeiten/text.ts";
import { sekundenBis } from "./eingabe.ts";
import type { Erkannt, Gestempelt } from "./typen.ts";

const NAMEN: Record<Aktion["name"], () => string> = {
  kommen: () => m.stempeln_kommen(),
  gehen: () => m.stempeln_gehen(),
  pause_starten: () => m.stempeln_pause_starten(),
  pause_beenden: () => m.stempeln_pause_beenden(),
};
const ICONS = { kommen: LogIn, gehen: LogOut, pause_starten: Pause, pause_beenden: Play };

const zustandText = (stand: Tagesstand): string => {
  if (stand.zustand === "arbeit" && stand.seit !== null)
    return m.stempeln_zustand_arbeit({ uhrzeit: uhrzeitText(stand.seit) });
  if (stand.zustand === "pause" && stand.seit !== null)
    return m.stempeln_zustand_pause({ uhrzeit: uhrzeitText(stand.seit) });
  return m.stempeln_zustand_aus();
};

const Kachel = (props: { name: string; wert: string }) => (
  <div class="flex flex-col gap-1 rounded-[14px] bg-muted px-5 py-4">
    <span class="text-[15px] text-muted-foreground">{props.name}</span>
    <span class="font-mono text-[24px] tabular-nums">{props.wert}</span>
  </div>
);

/** Target and actual of the day and the next finding with its norm (DESIGN.md, "Terminal") */
const Tag = (props: { tag: Erkannt["tag"] }) => (
  <Show when={props.tag}>
    {(tag) => (
      <>
        <div class="grid grid-cols-2 gap-4">
          <Kachel
            name={m.tag_soll()}
            wert={
              tag().sollMinuten === null
                ? m.soll_nicht_hinterlegt()
                : dauerText(tag().sollMinuten ?? 0)
            }
          />
          <Kachel name={m.tag_ist()} wert={dauerText(tag().stand.istMinuten)} />
        </div>
        <Show when={tag().stand.ausblick}>
          {(ausblick) => <AusblickKarte ausblick={ausblick()} />}
        </Show>
      </>
    )}
  </Show>
);

const Zurueck = (props: { bis: number; jetzt: number }) => (
  <span class="text-[15px] text-muted-foreground">
    {m.kiosk_zurueck({ sekunden: sekundenBis(props.bis, props.jetzt) })}
  </span>
);

/**
 * A person recognised: their name and state, the day so far, and the buttons for the next step;
 * the kiosk never stamps by itself (CLAUDE.md), and goes back after a while without a tap
 */
export const ErkanntAnsicht = (props: {
  daten: Erkannt;
  bis: number;
  jetzt: number;
  beschaeftigt: boolean;
  onStempeln: (art: Stempelart) => void;
  onFertig: () => void;
}) => {
  const aktionen = () => aktionenFuer(props.daten.tag?.stand.zustand ?? "aus");
  const Knopf = (p: { aktion: Aktion; haupt: boolean }) => (
    <Button
      variant={p.haupt ? "primary" : "outline"}
      disabled={props.beschaeftigt}
      class="h-24 flex-1 rounded-2xl text-[26px]"
      onClick={() => props.onStempeln(p.aktion.art)}
    >
      <Icon icon={ICONS[p.aktion.name]} size={28} />
      {NAMEN[p.aktion.name]()}
    </Button>
  );
  return (
    <section aria-label={props.daten.person.name} class="flex flex-col justify-center gap-7 p-16">
      <div class="flex flex-col gap-2">
        <h2 class="font-bold text-[44px] tracking-tight">
          {m.kiosk_hallo({ name: props.daten.person.name })}
        </h2>
        <p data-testid="zustand" class="text-[22px] text-muted-foreground">
          {zustandText(props.daten.tag?.stand ?? ({ zustand: "aus", seit: null } as Tagesstand))}
        </p>
      </div>
      <Tag tag={props.daten.tag} />
      <div class="flex gap-4">
        <Knopf aktion={aktionen().haupt} haupt />
        <Show when={aktionen().neben}>{(neben) => <Knopf aktion={neben()} haupt={false} />}</Show>
      </div>
      <div class="flex items-center justify-between">
        <Zurueck bis={props.bis} jetzt={props.jetzt} />
        <Button variant="ghost" class="h-16 px-6 text-[18px]" onClick={props.onFertig}>
          {m.kiosk_fertig()}
        </Button>
      </div>
    </section>
  );
};

/** The stamp confirmed (design/mockup/Terminal.dc.html, "Gestempelt"), back after 5 seconds */
export const GestempeltAnsicht = (props: { daten: Gestempelt; bis: number; jetzt: number }) => (
  <section
    role="status"
    aria-label={m.kiosk_gestempelt()}
    class="flex flex-col justify-center gap-7 p-16"
  >
    <div class="flex size-[88px] items-center justify-center rounded-full bg-success-surface">
      <Icon icon={Check} size={48} class="text-success" />
    </div>
    <div class="flex flex-col gap-2">
      <h2 class="font-bold text-[44px] tracking-tight">
        {m.kiosk_hallo({ name: props.daten.person.name })}
      </h2>
      <p class="text-[26px]">
        {m.kiosk_gestempelt_um({
          art: (ART_NAMEN[props.daten.stempel.art as Stempelart] ?? (() => ""))(),
          uhrzeit: uhrzeitText(props.daten.stempel.zeitpunkt),
        })}
      </p>
    </div>
    <Tag tag={props.daten.tag} />
    <Zurueck bis={props.bis} jetzt={props.jetzt} />
  </section>
);

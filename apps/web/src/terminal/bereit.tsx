import { Button, Icon } from "@soll/ui";
import { Nfc, QrCode } from "lucide";
import { createSignal, For, onSettled, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import type { Nfc as NfcStand } from "./ablauf.ts";
import { PIN_MIN, pinNach, pinVollstaendig, type Taste, tasteAus } from "./eingabe.ts";
import type { Meldung } from "./meldung.ts";
import { meldungText } from "./text.ts";
import { Ziffernfeld } from "./ziffernfeld.tsx";

/** The dots of the PIN typed so far: at least four, one more for each further digit */
const Punkte = (props: { anzahl: number }) => (
  <div
    role="img"
    aria-label={m.kiosk_pin_stand({ anzahl: props.anzahl })}
    dir="ltr"
    class="flex h-[22px] gap-5"
  >
    <For each={Array.from({ length: Math.max(PIN_MIN, props.anzahl) }, (_, i) => i)}>
      {(i) => (
        <span
          class={`size-[22px] rounded-full ${
            i < props.anzahl ? "bg-foreground" : "border-2 border-border"
          }`}
        />
      )}
    </For>
  </div>
);

/**
 * The right half while nobody is recognised: the PIN with the number pad, the QR code button where
 * the browser reads QR codes, and what went wrong last. A lock disables the pad until it ends. With
 * a plain card held to the tablet the PIN goes with the card (S-802); where Chrome waits for a tap to
 * allow NFC, a button asks for it.
 */
export const Bereit = (props: {
  meldung: Meldung | null;
  jetzt: number;
  mitQr: boolean;
  beschaeftigt: boolean;
  karte: boolean;
  nfc: NfcStand;
  onPin: (pin: string) => void;
  onScannen: () => void;
  onNfc: () => void;
}) => {
  const [pin, setPin] = createSignal("");
  const gesperrt = () => props.meldung?.art === "gesperrt";
  const taste = (t: Taste) => {
    if (gesperrt() || props.beschaeftigt) return;
    if (t.art === "ok") {
      if (!pinVollstaendig(pin())) return;
      const eingabe = pin();
      setPin("");
      return props.onPin(eingabe);
    }
    setPin((alt) => pinNach(alt, t));
  };
  onSettled(() => {
    const tastatur = (event: KeyboardEvent) => {
      const t = tasteAus(event.key);
      if (!t || (event.target as HTMLElement | null)?.closest("button")) return;
      event.preventDefault();
      taste(t);
    };
    window.addEventListener("keydown", tastatur);
    return () => window.removeEventListener("keydown", tastatur);
  });
  return (
    <section
      aria-label={m.kiosk_pin_eingeben()}
      class="flex flex-col items-center justify-center gap-8 p-12"
    >
      <div class="flex flex-col items-center gap-4">
        <span class="text-[22px] text-muted-foreground">
          {props.karte ? m.kiosk_karte_pin() : m.kiosk_pin()}
        </span>
        <Punkte anzahl={pin().length} />
      </div>
      <Ziffernfeld onTaste={taste} aus={gesperrt() || props.beschaeftigt} />
      <div role="status" aria-live="polite" class="min-h-7 text-center text-[18px]">
        <Show when={props.meldung}>
          {(meldung) => <span class="text-danger">{meldungText(meldung(), props.jetzt)}</span>}
        </Show>
      </div>
      <Show when={props.mitQr}>
        <Button variant="outline" class="h-16 px-6 text-[18px]" onClick={props.onScannen}>
          <Icon icon={QrCode} size={24} />
          {m.kiosk_qr_zeigen()}
        </Button>
      </Show>
      <Show when={props.nfc === "erlauben"}>
        <Button variant="outline" class="h-16 px-6 text-[18px]" onClick={props.onNfc}>
          <Icon icon={Nfc} size={24} />
          {m.kiosk_nfc_erlauben()}
        </Button>
      </Show>
      <span class="text-[15px] text-muted-foreground">{m.kiosk_sperre_hinweis()}</span>
    </section>
  );
};

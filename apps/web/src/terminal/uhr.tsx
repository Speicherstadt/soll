import { Icon } from "@soll/ui";
import { Nfc, QrCode } from "lucide";
import { m } from "../paraglide/messages.js";
import { datumText, uhrText } from "./text.ts";

/**
 * The left half of the kiosk (design/mockup/Terminal.dc.html): business and terminal, the clock in
 * large digits and what to do: the card where the tablet reads NFC (S-802), the QR code where it
 * reads those, always the PIN
 */
const hinweis = (mitNfc: boolean, mitQr: boolean): string => {
  if (mitNfc) return mitQr ? m.kiosk_hinweis_karte_qr() : m.kiosk_hinweis_karte();
  return mitQr ? m.kiosk_hinweis() : m.kiosk_hinweis_pin();
};

export const Uhr = (props: {
  betrieb: string;
  terminal: string;
  jetzt: number;
  mitQr: boolean;
  mitNfc: boolean;
}) => (
  <section
    aria-label={m.kiosk_uhr()}
    class="flex flex-col justify-between border-border border-e bg-muted px-16 py-14"
  >
    <div class="flex flex-col gap-2">
      <span class="font-semibold text-[20px]">{props.betrieb}</span>
      <span class="text-[17px] text-muted-foreground">{props.terminal}</span>
    </div>
    <div class="flex flex-col gap-3">
      <time
        data-testid="uhr"
        class="font-mono font-semibold text-[120px] tabular-nums leading-none tracking-tighter"
      >
        {uhrText(props.jetzt)}
      </time>
      <span class="text-[24px] text-muted-foreground">{datumText(props.jetzt)}</span>
    </div>
    <div class="flex items-center gap-4 text-[22px]">
      <Icon icon={props.mitNfc ? Nfc : QrCode} size={40} />
      <span>{hinweis(props.mitNfc, props.mitQr)}</span>
    </div>
  </section>
);

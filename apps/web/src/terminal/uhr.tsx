import { Icon } from "@soll/ui";
import { QrCode } from "lucide";
import { m } from "../paraglide/messages.js";
import { datumText, uhrText } from "./text.ts";

/**
 * The left half of the kiosk (design/mockup/Terminal.dc.html): business and terminal, the clock in
 * large digits and what to do; S-802 adds the card to the hint
 */
export const Uhr = (props: {
  betrieb: string;
  terminal: string;
  jetzt: number;
  mitQr: boolean;
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
      <Icon icon={QrCode} size={40} />
      <span>{props.mitQr ? m.kiosk_hinweis() : m.kiosk_hinweis_pin()}</span>
    </div>
  </section>
);

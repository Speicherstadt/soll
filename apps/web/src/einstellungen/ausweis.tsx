import { Button, Dialog } from "@soll/ui";
import { m } from "../paraglide/messages.js";
import { qrPfad } from "./qrPfad.ts";

/** A QR code drawn black on white in every theme, so it prints and scans the same */
export const QrBild = (props: { wert: string; name: string }) => {
  const qr = () => qrPfad(props.wert);
  return (
    <svg
      role="img"
      aria-label={m.terminal_qr_bild({ name: props.name })}
      viewBox={`0 0 ${qr().groesse} ${qr().groesse}`}
      class="size-56"
      shape-rendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path d={qr().pfad} fill="#000000" />
    </svg>
  );
};

/**
 * A person's QR code right after it was issued (S-801): shown once, for printing; Soll keeps only
 * its hash. The card is the only thing on the printed page (styles.css, `data-druck`).
 */
export const AusweisDialog = (props: {
  ausweis: { name: string; wert: string } | null;
  onSchliessen: () => void;
}) => (
  <Dialog
    offen={props.ausweis !== null}
    titel={m.terminal_qr_titel({ name: props.ausweis?.name ?? "" })}
    onSchliessen={props.onSchliessen}
    aktionen={
      <>
        <Button variant="outline" onClick={props.onSchliessen}>
          {m.terminal_schliessen()}
        </Button>
        <Button onClick={() => window.print()}>{m.terminal_drucken()}</Button>
      </>
    }
  >
    <div class="flex flex-col items-center gap-3">
      <p class="text-muted-foreground">{m.terminal_qr_text()}</p>
      <div
        data-druck
        class="flex flex-col items-center gap-2 rounded-lg border border-border bg-white p-4 text-black"
      >
        <QrBild wert={props.ausweis?.wert ?? ""} name={props.ausweis?.name ?? ""} />
        <span class="font-semibold text-[15px]">{props.ausweis?.name}</span>
      </div>
    </div>
  </Dialog>
);

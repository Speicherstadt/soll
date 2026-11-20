import { Button } from "@soll/ui";
import { createSignal, onSettled, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { type DetectorKlasse, qrLesen } from "./qr.ts";

/**
 * Reading a QR code with the front camera (S-801): the picture shows only on the screen, as a
 * mirror for holding the code; what leaves is the decoded text (qr.ts)
 */
export const Scannen = (props: {
  Detector: DetectorKlasse;
  onWert: (wert: string) => void;
  onAbbrechen: () => void;
}) => {
  const [fehler, setFehler] = createSignal(false);
  let video: HTMLVideoElement | undefined;
  onSettled(() => {
    const abbruch = new AbortController();
    if (video)
      qrLesen(video, abbruch.signal, { kamera: navigator.mediaDevices, Detector: props.Detector })
        .then((wert) => wert && props.onWert(wert))
        .catch(() => setFehler(true));
    return () => abbruch.abort();
  });
  return (
    <section
      aria-label={m.kiosk_qr_zeigen()}
      class="flex flex-col items-center justify-center gap-6 p-12"
    >
      <p class="text-[22px]">{m.kiosk_qr_text()}</p>
      <video
        ref={(el) => {
          video = el;
        }}
        muted
        playsinline
        class="aspect-video w-[480px] -scale-x-100 rounded-2xl bg-muted object-cover"
      />
      <Show when={fehler()}>
        <p role="alert" class="text-[18px] text-danger">
          {m.kiosk_kamera_fehler()}
        </p>
      </Show>
      <Button variant="outline" class="h-16 px-8 text-[18px]" onClick={props.onAbbrechen}>
        {m.abbrechen()}
      </Button>
    </section>
  );
};

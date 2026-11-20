import { createSignal, Match, onSettled, Show, Switch } from "solid-js";
import { m } from "../paraglide/messages.js";
import { kioskAblauf } from "./ablauf.ts";
import { Bereit } from "./bereit.tsx";
import { Koppeln } from "./koppeln.tsx";
import { neuladenBeiFehler } from "./neuladen.ts";
import { ErkanntAnsicht, GestempeltAnsicht } from "./person.tsx";
import { type DetectorKlasse, qrDetector } from "./qr.ts";
import { Scannen } from "./scannen.tsx";
import { Uhr } from "./uhr.tsx";
import { bildschirmWachHalten, type WakeLock } from "./wachhalten.ts";

/** Keeps the screen on and heals the kiosk: reload after an error and when the network is back */
const wachUndHeil = (melden: () => void) =>
  onSettled(() => {
    const wach = bildschirmWachHalten((navigator as { wakeLock?: WakeLock }).wakeLock, document);
    const heil = neuladenBeiFehler({
      fenster: window,
      neuladen: () => location.reload(),
      melden,
      warten: (aufgabe, ms) => setTimeout(aufgabe, ms),
    });
    return () => {
      wach();
      heil();
    };
  });

/**
 * The terminal in kiosk mode on a tablet in landscape, 1280 × 800 (S-801, DESIGN.md "Terminal"):
 * the clock on the left, on the right the number pad, the camera for a QR code, the person
 * recognised or the stamp confirmed. No navigation and no other data.
 */
export const Kiosk = () => {
  const kiosk = kioskAblauf();
  const [neustart, setNeustart] = createSignal(false);
  wachUndHeil(() => setNeustart(true));
  const Detector = qrDetector();
  const erkannt = () => {
    const a = kiosk.ansicht();
    return a.art === "erkannt" ? a : null;
  };
  const gestempelt = () => {
    const a = kiosk.ansicht();
    return a.art === "gestempelt" ? a : null;
  };
  return (
    <Show when={kiosk.kopplung()} fallback={<Koppeln onKoppeln={kiosk.koppeln} />}>
      {(kopplung) => (
        <main class="grid h-dvh grid-cols-2 overflow-hidden bg-background text-foreground">
          <h1 class="sr-only">{m.kiosk_titel()}</h1>
          <Uhr
            betrieb={kiosk.stand()?.betrieb ?? kopplung().betrieb}
            terminal={kiosk.stand()?.name ?? kopplung().name}
            jetzt={kiosk.jetzt()}
            mitQr={Detector !== undefined}
          />
          <Show when={neustart()}>
            <p role="alert" class="fixed inset-x-0 top-0 bg-danger p-4 text-center text-background">
              {m.kiosk_neustart()}
            </p>
          </Show>
          <Switch>
            <Match when={kiosk.ansicht().art === "scannen" && Detector !== undefined}>
              <Scannen
                Detector={Detector as DetectorKlasse}
                onWert={(qr) => kiosk.erkennen({ qr })}
                onAbbrechen={kiosk.zurueck}
              />
            </Match>
            <Match when={erkannt()}>
              {(a) => (
                <ErkanntAnsicht
                  daten={a().daten}
                  bis={a().bis}
                  jetzt={kiosk.jetzt()}
                  beschaeftigt={kiosk.beschaeftigt()}
                  onStempeln={kiosk.stempeln}
                  onFertig={kiosk.zurueck}
                />
              )}
            </Match>
            <Match when={gestempelt()}>
              {(a) => <GestempeltAnsicht daten={a().daten} bis={a().bis} jetzt={kiosk.jetzt()} />}
            </Match>
            <Match when={true}>
              <Bereit
                meldung={kiosk.meldung()}
                jetzt={kiosk.jetzt()}
                mitQr={Detector !== undefined}
                beschaeftigt={kiosk.beschaeftigt()}
                onPin={(pin) => kiosk.erkennen({ pin })}
                onScannen={kiosk.scannen}
              />
            </Match>
          </Switch>
        </main>
      )}
    </Show>
  );
};

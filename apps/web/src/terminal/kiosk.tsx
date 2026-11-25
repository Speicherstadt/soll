import { createSignal, Match, onSettled, Show, Switch } from "solid-js";
import { m } from "../paraglide/messages.js";
import { kioskAblauf, type Nfc } from "./ablauf.ts";
import { Bereit } from "./bereit.tsx";
import { Koppeln } from "./koppeln.tsx";
import { neuladenBeiFehler } from "./neuladen.ts";
import { type NdefLeserKlasse, type NfcKarte, nfcLesen, nfcLeser } from "./nfc.ts";
import { GespeichertAnsicht, OhneNetzAnsicht } from "./offline/ansichten.tsx";
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
 * Listens for NFC cards while the kiosk is open (S-802). Chrome asks for permission on the first
 * scan and wants a tap for it: a refused start leaves the kiosk waiting for the button that calls
 * the returned function again.
 */
const nfcBereit = (
  Leser: NdefLeserKlasse,
  onKarte: (karte: NfcKarte) => void,
  setNfc: (stand: Nfc) => void,
) => {
  let abbruch: AbortController | undefined;
  const starten = () => {
    abbruch?.abort();
    abbruch = new AbortController();
    nfcLesen(Leser, abbruch.signal, onKarte).then(
      () => setNfc("an"),
      () => setNfc("erlauben"),
    );
  };
  onSettled(() => {
    starten();
    return () => abbruch?.abort();
  });
  return starten;
};

/**
 * The terminal in kiosk mode on a tablet in landscape, 1280 × 800 (S-801, DESIGN.md "Terminal"):
 * the clock on the left, on the right the number pad, the camera for a QR code, the person
 * recognised or the stamp confirmed; NFC cards where the browser reads them (S-802); without a
 * network the choice without the person's state and the stamp kept on the tablet (S-803). No
 * navigation and no other data.
 */
export const Kiosk = () => {
  const kiosk = kioskAblauf();
  const [neustart, setNeustart] = createSignal(false);
  wachUndHeil(() => setNeustart(true));
  const Detector = qrDetector();
  const Leser = nfcLeser();
  const nfcErlauben = Leser ? nfcBereit(Leser, kiosk.karteGelesen, kiosk.setNfc) : () => undefined;
  const erkannt = () => {
    const a = kiosk.ansicht();
    return a.art === "erkannt" ? a : null;
  };
  const gestempelt = () => {
    const a = kiosk.ansicht();
    return a.art === "gestempelt" ? a : null;
  };
  const ohneNetz = () => {
    const a = kiosk.ansicht();
    return a.art === "offline" ? a : null;
  };
  const gespeichert = () => {
    const a = kiosk.ansicht();
    return a.art === "gespeichert" ? a : null;
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
            mitNfc={kiosk.nfc() === "an"}
            ohneNetz={kiosk.schlange.ohneNetz()}
            wartend={kiosk.schlange.wartend()}
            zuletzt={kiosk.schlange.zuletzt()}
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
            <Match when={ohneNetz()}>
              {(a) => (
                <OhneNetzAnsicht
                  bis={a().bis}
                  jetzt={kiosk.jetzt()}
                  beschaeftigt={kiosk.beschaeftigt()}
                  onStempeln={kiosk.stempeln}
                  onFertig={kiosk.zurueck}
                />
              )}
            </Match>
            <Match when={gespeichert()}>
              {(a) => (
                <GespeichertAnsicht
                  stempelart={a().stempelart}
                  zeitpunkt={a().zeitpunkt}
                  bis={a().bis}
                  jetzt={kiosk.jetzt()}
                />
              )}
            </Match>
            <Match when={true}>
              <Bereit
                meldung={kiosk.meldung()}
                jetzt={kiosk.jetzt()}
                mitQr={Detector !== undefined}
                beschaeftigt={kiosk.beschaeftigt()}
                karte={kiosk.karte() !== null}
                nfc={kiosk.nfc()}
                onPin={kiosk.pin}
                onScannen={kiosk.scannen}
                onNfc={nfcErlauben}
              />
            </Match>
          </Switch>
        </main>
      )}
    </Show>
  );
};

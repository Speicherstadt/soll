/** How long the kiosk shows that it starts again before it reloads after an error */
export const NEULADEN_NACH_FEHLER_MS = 5000;

type Fenster = Pick<Window, "addEventListener" | "removeEventListener">;

/**
 * A kiosk nobody tends must heal itself (S-801): after an uncaught error it says so and reloads,
 * and when the network comes back it reloads at once, so it runs on the current state and code.
 * Returns the cleanup.
 */
export const neuladenBeiFehler = (deps: {
  fenster: Fenster;
  neuladen: () => void;
  melden: () => void;
  warten: (aufgabe: () => void, ms: number) => unknown;
}) => {
  let geplant = false;
  const nachFehler = () => {
    if (geplant) return;
    geplant = true;
    deps.melden();
    deps.warten(deps.neuladen, NEULADEN_NACH_FEHLER_MS);
  };
  const online = () => deps.neuladen();
  deps.fenster.addEventListener("error", nachFehler);
  deps.fenster.addEventListener("unhandledrejection", nachFehler);
  deps.fenster.addEventListener("online", online);
  return () => {
    deps.fenster.removeEventListener("error", nachFehler);
    deps.fenster.removeEventListener("unhandledrejection", nachFehler);
    deps.fenster.removeEventListener("online", online);
  };
};

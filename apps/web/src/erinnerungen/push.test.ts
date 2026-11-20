import { describe, expect, it } from "vitest";
import type { Antwort } from "../api.ts";
import {
  type Abo,
  ausschalten,
  einschalten,
  schluesselBytes,
  standLesen,
  type Umgebung,
} from "./push.ts";

const abo = (endpoint = "https://push.example.test/a") => {
  let beendet = false;
  const a: Abo & { beendet: () => boolean } = {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: "BPK", auth: "AUTH" } }),
    unsubscribe: async () => {
      beendet = true;
      return true;
    },
    beendet: () => beendet,
  };
  return a;
};

const umgebung = (
  mehr: {
    erlaubnis?: "granted" | "denied";
    antwort?: Antwort<unknown>;
    vorhanden?: Abo | null;
    ohne?: boolean;
  } = {},
) => {
  const aufrufe: { pfad: string; init: { method?: string; body?: unknown } }[] = [];
  let aktuell: Abo | null = mehr.vorhanden ?? null;
  const neu = abo();
  const optionen: unknown[] = [];
  const u: Umgebung = {
    registrierung: async () =>
      mehr.ohne
        ? null
        : {
            pushManager: {
              getSubscription: async () => aktuell,
              subscribe: async (o) => {
                optionen.push(o);
                aktuell = neu;
                return neu;
              },
            },
          },
    erlaubnis: async () => mehr.erlaubnis ?? "granted",
    api: async (pfad, init) => {
      aufrufe.push({ pfad, init });
      return mehr.antwort ?? { ok: true, status: 201, daten: { ok: true } };
    },
  };
  return { u, aufrufe, neu, optionen };
};

describe("Web Push on this device", () => {
  it("turns the VAPID key from base64url into bytes", () => {
    expect([...schluesselBytes("BP4z-_8")]).toEqual([4, 254, 51, 251, 255]);
  });

  it("subscribes with the server's key and registers the device in the app's language", async () => {
    const { u, aufrufe, optionen } = umgebung();
    expect(await standLesen(u)).toBe("aus");
    expect(await einschalten(u, "BP4z", "uk")).toEqual({ ok: true });
    expect(optionen).toEqual([
      { userVisibleOnly: true, applicationServerKey: schluesselBytes("BP4z") },
    ]);
    expect(aufrufe).toEqual([
      {
        pfad: "/api/v1/arbeitszeit/erinnerungen/abos",
        init: {
          body: {
            endpoint: "https://push.example.test/a",
            keys: { p256dh: "BPK", auth: "AUTH" },
            sprache: "uk",
          },
        },
      },
    ]);
    expect(await standLesen(u)).toBe("an");
  });

  it("says so where there is no service worker, and asks the server nothing", async () => {
    const { u, aufrufe } = umgebung({ ohne: true });
    expect(await standLesen(u)).toBe("nicht_verfuegbar");
    expect(await einschalten(u, "BP4z", "de")).toEqual({ ok: false, grund: "nicht_verfuegbar" });
    expect(aufrufe).toEqual([]);
  });

  it("stops when the person does not allow notifications", async () => {
    const { u, aufrufe } = umgebung({ erlaubnis: "denied" });
    expect(await einschalten(u, "BP4z", "de")).toEqual({ ok: false, grund: "abgelehnt" });
    expect(aufrufe).toEqual([]);
  });

  it("ends the subscription again when the server does not take it", async () => {
    const { u, neu } = umgebung({
      antwort: { ok: false, status: 400, fehler: "schluessel_ungueltig" },
    });
    expect(await einschalten(u, "BP4z", "de")).toEqual({ ok: false, grund: "server" });
    expect((neu as ReturnType<typeof abo>).beendet()).toBe(true);
  });

  it("unregisters the device with the server before ending the subscription", async () => {
    const vorhanden = abo("https://push.example.test/b");
    const { u, aufrufe } = umgebung({ vorhanden, antwort: { ok: true, status: 204, daten: null } });
    expect(await ausschalten(u)).toEqual({ ok: true });
    expect(aufrufe).toEqual([
      {
        pfad: "/api/v1/arbeitszeit/erinnerungen/abos",
        init: { method: "DELETE", body: { endpoint: "https://push.example.test/b" } },
      },
    ]);
    expect(vorhanden.beendet()).toBe(true);
  });

  it("keeps the subscription when the server cannot be reached, so turning off can be tried again", async () => {
    const vorhanden = abo();
    const { u } = umgebung({ vorhanden, antwort: { ok: false, status: 0, fehler: "netz" } });
    expect(await ausschalten(u)).toEqual({ ok: false, grund: "server" });
    expect(vorhanden.beendet()).toBe(false);
  });
});

import { DEMO_PERSONEN } from "./demoDaten.ts";

export const DEMO_VORLAGEN = [
  {
    vorlageId: "v-frueh",
    name: "Tagschicht",
    beginnMinute: 420,
    endeMinute: 930,
    pauseMinuten: 30,
    rolle: "Montage",
    standortId: "st1",
  },
  {
    vorlageId: "v-tag",
    name: "Kundendienst",
    beginnMinute: 480,
    endeMinute: 990,
    pauseMinuten: 30,
    rolle: "Service",
    standortId: "st1",
  },
  {
    vorlageId: "v-spaet",
    name: "Nachmittag",
    beginnMinute: 540,
    endeMinute: 1050,
    pauseMinuten: 30,
    rolle: "Montage",
    standortId: "st1",
  },
];

const isoWocheVonTag = (tag: string): { montag: Date; jahr: number; nummer: number } => {
  const basis = /^\d{4}-\d{2}-\d{2}$/.test(tag) ? new Date(`${tag}T12:00:00Z`) : new Date();
  const wochentag = basis.getUTCDay() || 7;
  const montag = new Date(basis.getTime() - (wochentag - 1) * 86_400_000);
  const donnerstag = new Date(montag.getTime() + 3 * 86_400_000);
  const jahr = donnerstag.getUTCFullYear();
  const jan1 = new Date(Date.UTC(jahr, 0, 1, 12));
  const nummer = Math.floor((donnerstag.getTime() - jan1.getTime()) / (7 * 86_400_000)) + 1;
  return { montag, jahr, nummer };
};

const zeitMs = (tag: string, minuten: number): number => {
  const h = String(Math.floor(minuten / 60)).padStart(2, "0");
  const m = String(minuten % 60).padStart(2, "0");
  return Date.parse(`${tag}T${h}:${m}:00+01:00`);
};

/** Builds realistic weekly rota data for the requested ISO week in static demo mode */
export const wocheDaten = (query: URLSearchParams, heuteTag: string) => {
  const { montag, jahr, nummer } = isoWocheVonTag(query.get("tag") ?? heuteTag);
  const tage = Array.from({ length: 7 }, (_, i) =>
    new Date(montag.getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
  const werkte = tage.slice(0, 5);
  const muster = [
    { nutzerId: DEMO_PERSONEN[0]?.nutzerId ?? "jonas", vorlage: DEMO_VORLAGEN[0] },
    { nutzerId: DEMO_PERSONEN[1]?.nutzerId ?? "anna", vorlage: DEMO_VORLAGEN[1] },
    { nutzerId: DEMO_PERSONEN[2]?.nutzerId ?? "sandra", vorlage: DEMO_VORLAGEN[0] },
    { nutzerId: DEMO_PERSONEN[3]?.nutzerId ?? "max", vorlage: DEMO_VORLAGEN[2] },
    { nutzerId: DEMO_PERSONEN[4]?.nutzerId ?? "leon", vorlage: DEMO_VORLAGEN[1] },
  ];
  const schichten = werkte.flatMap((tag, ti) =>
    muster
      .filter((_, pi) => !(ti === 4 && pi === 3))
      .map((m, pi) => ({
        schichtId: `ds-${nummer}-${ti}-${pi}`,
        nutzerId: m.nutzerId,
        tag,
        beginn: zeitMs(tag, m.vorlage?.beginnMinute ?? 420),
        ende: zeitMs(tag, m.vorlage?.endeMinute ?? 930),
        pauseMinuten: m.vorlage?.pauseMinuten ?? 30,
        rolle: m.vorlage?.rolle ?? "Montage",
        standortId: "st1",
        vorlageId: m.vorlage?.vorlageId ?? null,
        veroeffentlichtAm: Date.now() - 86_400_000,
      })),
  );
  return {
    standortId: "st1",
    tage,
    kw: { jahr, nummer },
    personen: DEMO_PERSONEN.map((p) => ({ nutzerId: p.nutzerId, name: p.name })),
    schichten,
    deckung: [],
    befunde: [],
  };
};

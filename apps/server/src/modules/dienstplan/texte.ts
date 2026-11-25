import type { Tag } from "@soll/arbeitszeit";
import type { Sprache } from "../erinnerungen/index.ts";
import type { Meldung, Zeitraum } from "./meldungen.ts";

/*
 * The texts of the plan outside the app (S-503): the notifications in the language of each device
 * (the mail German, as every mail of Soll) and the words of the calendar feed in the language the
 * app had when the feed was issued. The six languages of the app (docs/plan.md, "Sprachen").
 */

type Werte = { kw: number; datum: string; zeit: string };
type Vorlage = { titel: string; text: (w: Werte) => string };
type Woerter = { schicht: string; pause: string; minuten: string };

const TEXTE: Record<Sprache, Record<Meldung["art"], Vorlage> & { woerter: Woerter }> = {
  de: {
    veroeffentlicht: {
      titel: "Dienstplan veröffentlicht",
      text: (w) => `Deine Schichten für KW ${w.kw} stehen im Plan.`,
    },
    neu: { titel: "Neue Schicht", text: (w) => `Du bist eingeplant: ${w.datum}, ${w.zeit}.` },
    geaendert: {
      titel: "Schicht geändert",
      text: (w) => `Deine Schicht ist jetzt am ${w.datum}, ${w.zeit}.`,
    },
    entfaellt: {
      titel: "Schicht entfällt",
      text: (w) => `Deine Schicht am ${w.datum}, ${w.zeit} entfällt.`,
    },
    woerter: { schicht: "Schicht", pause: "Pause", minuten: "min" },
  },
  en: {
    veroeffentlicht: {
      titel: "Rota published",
      text: (w) => `Your shifts for week ${w.kw} are in the plan.`,
    },
    neu: { titel: "New shift", text: (w) => `You are scheduled: ${w.datum}, ${w.zeit}.` },
    geaendert: {
      titel: "Shift changed",
      text: (w) => `Your shift is now on ${w.datum}, ${w.zeit}.`,
    },
    entfaellt: {
      titel: "Shift cancelled",
      text: (w) => `Your shift on ${w.datum}, ${w.zeit} is cancelled.`,
    },
    woerter: { schicht: "Shift", pause: "Break", minuten: "min" },
  },
  tr: {
    veroeffentlicht: {
      titel: "Vardiya planı yayımlandı",
      text: (w) => `${w.kw}. hafta vardiyaların planda.`,
    },
    neu: { titel: "Yeni vardiya", text: (w) => `Planlandın: ${w.datum}, ${w.zeit}.` },
    geaendert: { titel: "Vardiya değişti", text: (w) => `Vardiyan artık: ${w.datum}, ${w.zeit}.` },
    entfaellt: {
      titel: "Vardiya iptal edildi",
      text: (w) => `${w.datum}, ${w.zeit} vardiyan iptal edildi.`,
    },
    woerter: { schicht: "Vardiya", pause: "Mola", minuten: "dk" },
  },
  pl: {
    veroeffentlicht: {
      titel: "Grafik opublikowany",
      text: (w) => `Twoje zmiany na tydzień ${w.kw} są w grafiku.`,
    },
    neu: { titel: "Nowa zmiana", text: (w) => `Masz zmianę: ${w.datum}, ${w.zeit}.` },
    geaendert: {
      titel: "Zmiana w grafiku",
      text: (w) => `Twoja zmiana jest teraz: ${w.datum}, ${w.zeit}.`,
    },
    entfaellt: {
      titel: "Zmiana odwołana",
      text: (w) => `Twoja zmiana ${w.datum}, ${w.zeit} jest odwołana.`,
    },
    woerter: { schicht: "Zmiana", pause: "Przerwa", minuten: "min" },
  },
  uk: {
    veroeffentlicht: {
      titel: "Графік опубліковано",
      text: (w) => `Ваші зміни на тиждень ${w.kw} у графіку.`,
    },
    neu: { titel: "Нова зміна", text: (w) => `Вас заплановано: ${w.datum}, ${w.zeit}.` },
    geaendert: {
      titel: "Зміну змінено",
      text: (w) => `Ваша зміна тепер: ${w.datum}, ${w.zeit}.`,
    },
    entfaellt: {
      titel: "Зміну скасовано",
      text: (w) => `Вашу зміну ${w.datum}, ${w.zeit} скасовано.`,
    },
    woerter: { schicht: "Зміна", pause: "Перерва", minuten: "хв" },
  },
  ar: {
    veroeffentlicht: {
      titel: "تم نشر جدول المناوبات",
      text: (w) => `مناوباتك للأسبوع ${w.kw} موجودة في الجدول.`,
    },
    neu: { titel: "مناوبة جديدة", text: (w) => `تمت جدولتك: ${w.datum}، ${w.zeit}.` },
    geaendert: {
      titel: "تم تغيير المناوبة",
      text: (w) => `مناوبتك الآن: ${w.datum}، ${w.zeit}.`,
    },
    entfaellt: {
      titel: "أُلغيت المناوبة",
      text: (w) => `أُلغيت مناوبتك في ${w.datum}، ${w.zeit}.`,
    },
    woerter: { schicht: "مناوبة", pause: "استراحة", minuten: "دقيقة" },
  },
};

const uhrzeit = (sprache: Sprache, zeitpunkt: number) =>
  new Intl.DateTimeFormat(sprache, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Berlin",
  }).format(zeitpunkt);

/** "Mo., 23.11.": the working day at noon UTC is that day in every zone */
const datum = (sprache: Sprache, tag: Tag) =>
  new Intl.DateTimeFormat(sprache, {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  }).format(Date.parse(`${tag}T12:00:00Z`));

const werteVon = (sprache: Sprache, schicht: Zeitraum): Werte => ({
  kw: 0,
  datum: datum(sprache, schicht.tag),
  zeit: `${uhrzeit(sprache, schicht.beginn)}–${uhrzeit(sprache, schicht.ende)}`,
});

/** The title and text of a message about the plan in a language */
export const meldungText = (meldung: Meldung, sprache: Sprache) => {
  const vorlage = TEXTE[sprache][meldung.art];
  const werte =
    meldung.art === "veroeffentlicht"
      ? { kw: meldung.kw, datum: "", zeit: "" }
      : werteVon(sprache, meldung.schicht);
  return { titel: vorlage.titel, text: vorlage.text(werte) };
};

/** Where a tap leads: the week of the shift in the plan */
export const meldungZiel = (meldung: Meldung): string =>
  `/dienstplan?tag=${meldung.art === "veroeffentlicht" ? meldung.tag : meldung.schicht.tag}`;

/**
 * The tag of the notification on the device, which replaces an earlier one with the same tag: one
 * per shift for its changes, so a later change replaces the earlier of the same shift and never the
 * message about another; one per week and site for a publication (review of S-503)
 */
export const meldungTag = (meldung: Meldung): string =>
  meldung.art === "veroeffentlicht"
    ? `plan-${meldung.standortId}-${meldung.tag}`
    : `plan-${meldung.schicht.schichtId}`;

/** The title of a shift in the feed: "Schicht · Service", without a role "Schicht" */
export const terminTitel = (sprache: Sprache, rolle: string): string =>
  rolle ? `${TEXTE[sprache].woerter.schicht} · ${rolle}` : TEXTE[sprache].woerter.schicht;

/** The description of a shift in the feed: its break, nothing without one */
export const terminBeschreibung = (sprache: Sprache, pauseMinuten: number): string => {
  const { pause, minuten } = TEXTE[sprache].woerter;
  return pauseMinuten > 0 ? `${pause}: ${pauseMinuten} ${minuten}` : "";
};

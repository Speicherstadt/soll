import type { Sprache } from "../erinnerungen/index.ts";
import type { RufArt } from "./meldungen.ts";
import type { Vorlage } from "./texte.ts";

/*
 * The texts of Rufbereitschaft outside the app (S-505): its notifications in the six languages of
 * the app and its word in the calendar feed, like those of a shift (texte.ts)
 */

type Ruftexte = Record<RufArt, Vorlage> & { wort: string; reaktion: string; minuten: string };

export const RUF_TEXTE: Record<Sprache, Ruftexte> = {
  de: {
    ruf_neu: {
      titel: "Neue Rufbereitschaft",
      text: (w) => `Du hast Rufbereitschaft: ${w.datum}, ${w.zeit}.`,
    },
    ruf_geaendert: {
      titel: "Rufbereitschaft geändert",
      text: (w) => `Deine Rufbereitschaft ist jetzt am ${w.datum}, ${w.zeit}.`,
    },
    ruf_entfaellt: {
      titel: "Rufbereitschaft entfällt",
      text: (w) => `Deine Rufbereitschaft am ${w.datum}, ${w.zeit} entfällt.`,
    },
    wort: "Rufbereitschaft",
    reaktion: "Reaktionszeit",
    minuten: "min",
  },
  en: {
    ruf_neu: { titel: "New on-call duty", text: (w) => `You are on call: ${w.datum}, ${w.zeit}.` },
    ruf_geaendert: {
      titel: "On-call duty changed",
      text: (w) => `Your on-call duty is now on ${w.datum}, ${w.zeit}.`,
    },
    ruf_entfaellt: {
      titel: "On-call duty cancelled",
      text: (w) => `Your on-call duty on ${w.datum}, ${w.zeit} is cancelled.`,
    },
    wort: "On call",
    reaktion: "Response time",
    minuten: "min",
  },
  tr: {
    ruf_neu: {
      titel: "Yeni nöbet (çağrı)",
      text: (w) => `Çağrı nöbetin var: ${w.datum}, ${w.zeit}.`,
    },
    ruf_geaendert: {
      titel: "Çağrı nöbeti değişti",
      text: (w) => `Çağrı nöbetin artık: ${w.datum}, ${w.zeit}.`,
    },
    ruf_entfaellt: {
      titel: "Çağrı nöbeti iptal edildi",
      text: (w) => `${w.datum}, ${w.zeit} çağrı nöbetin iptal edildi.`,
    },
    wort: "Çağrı nöbeti",
    reaktion: "Tepki süresi",
    minuten: "dk",
  },
  pl: {
    ruf_neu: {
      titel: "Nowy dyżur pod telefonem",
      text: (w) => `Masz dyżur: ${w.datum}, ${w.zeit}.`,
    },
    ruf_geaendert: {
      titel: "Dyżur zmieniony",
      text: (w) => `Twój dyżur jest teraz: ${w.datum}, ${w.zeit}.`,
    },
    ruf_entfaellt: {
      titel: "Dyżur odwołany",
      text: (w) => `Twój dyżur ${w.datum}, ${w.zeit} jest odwołany.`,
    },
    wort: "Dyżur pod telefonem",
    reaktion: "Czas reakcji",
    minuten: "min",
  },
  uk: {
    ruf_neu: {
      titel: "Нове чергування на виклик",
      text: (w) => `У вас чергування на виклик: ${w.datum}, ${w.zeit}.`,
    },
    ruf_geaendert: {
      titel: "Чергування змінено",
      text: (w) => `Ваше чергування тепер: ${w.datum}, ${w.zeit}.`,
    },
    ruf_entfaellt: {
      titel: "Чергування скасовано",
      text: (w) => `Ваше чергування ${w.datum}, ${w.zeit} скасовано.`,
    },
    wort: "Чергування на виклик",
    reaktion: "Час реагування",
    minuten: "хв",
  },
  ar: {
    ruf_neu: {
      titel: "مناوبة استدعاء جديدة",
      text: (w) => `لديك مناوبة استدعاء: ${w.datum}، ${w.zeit}.`,
    },
    ruf_geaendert: {
      titel: "تم تغيير مناوبة الاستدعاء",
      text: (w) => `مناوبة الاستدعاء الآن: ${w.datum}، ${w.zeit}.`,
    },
    ruf_entfaellt: {
      titel: "أُلغيت مناوبة الاستدعاء",
      text: (w) => `أُلغيت مناوبة الاستدعاء في ${w.datum}، ${w.zeit}.`,
    },
    wort: "مناوبة استدعاء",
    reaktion: "وقت الاستجابة",
    minuten: "دقيقة",
  },
};

/** The description of a Rufbereitschaft in the feed: its reaction time, nothing without one */
export const rufBeschreibung = (sprache: Sprache, reaktionMinuten: number | null): string => {
  const { reaktion, minuten } = RUF_TEXTE[sprache];
  return reaktionMinuten === null ? "" : `${reaktion}: ${reaktionMinuten} ${minuten}`;
};

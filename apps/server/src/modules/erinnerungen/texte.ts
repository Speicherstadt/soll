import type { Faellig } from "./faellig.ts";

/*
 * The texts of a reminder (S-307). A notification is shown by the service worker without the app,
 * so the server writes it in the language the app had on the device when it subscribed, in the
 * six languages of the app (docs/plan.md, "Sprachen"); a norm stays German in every language
 * (CLAUDE.md). Mail is German, as the time sheet (docs/plan.md, "Sprache des Stundenzettels").
 */

export const SPRACHEN = ["de", "en", "tr", "pl", "uk", "ar"] as const;
export type Sprache = (typeof SPRACHEN)[number];

export const spracheVon = (wert: string): Sprache =>
  (SPRACHEN as readonly string[]).includes(wert) ? (wert as Sprache) : "de";

type Werte = { uhrzeit: string; minuten: number; monat: string };
type Vorlage = { titel: string; text: (w: Werte) => string };

const TEXTE: Record<Sprache, Record<Faellig["art"], Vorlage>> = {
  de: {
    ausstempeln: {
      titel: "Ausstempeln vergessen?",
      text: (w) =>
        `Du bist seit ${w.uhrzeit} Uhr eingestempelt. Soll stempelt nie selbst aus: Trag dein Gehen ein, wenn du schon weg bist.`,
    },
    pause: {
      titel: "Pause fällig",
      text: (w) => `Um ${w.uhrzeit} Uhr brauchst du ${w.minuten} Minuten Pause (§ 4 ArbZG).`,
    },
    monat: {
      titel: "Monat bestätigen",
      text: (w) => `Bitte prüfe und bestätige deine Zeiten für ${w.monat}.`,
    },
  },
  en: {
    ausstempeln: {
      titel: "Forgot to clock out?",
      text: (w) =>
        `You have been clocked in since ${w.uhrzeit}. Soll never clocks you out: add your clock-out if you have already left.`,
    },
    pause: {
      titel: "Break due",
      text: (w) => `At ${w.uhrzeit} you need a ${w.minuten}-minute break (§ 4 ArbZG).`,
    },
    monat: {
      titel: "Confirm your month",
      text: (w) => `Please check and confirm your times for ${w.monat}.`,
    },
  },
  tr: {
    ausstempeln: {
      titel: "Çıkış yapmayı mı unuttun?",
      text: (w) =>
        `${w.uhrzeit} saatinden beri giriş yapmış durumdasın. Soll asla kendiliğinden çıkış yapmaz: Zaten ayrıldıysan çıkışını ekle.`,
    },
    pause: {
      titel: "Mola zamanı",
      text: (w) => `Saat ${w.uhrzeit} itibarıyla ${w.minuten} dakika mola vermelisin (§ 4 ArbZG).`,
    },
    monat: {
      titel: "Ayı onayla",
      text: (w) => `Lütfen ${w.monat} için çalışma saatlerini kontrol edip onayla.`,
    },
  },
  pl: {
    ausstempeln: {
      titel: "Zapomniałeś się odbić?",
      text: (w) =>
        `Jesteś odbity od ${w.uhrzeit}. Soll nigdy nie kończy pracy za ciebie: dodaj wyjście, jeśli już wyszedłeś.`,
    },
    pause: {
      titel: "Czas na przerwę",
      text: (w) => `O ${w.uhrzeit} potrzebujesz ${w.minuten} minut przerwy (§ 4 ArbZG).`,
    },
    monat: {
      titel: "Potwierdź miesiąc",
      text: (w) => `Sprawdź i potwierdź swoje godziny za ${w.monat}.`,
    },
  },
  uk: {
    ausstempeln: {
      titel: "Забули відмітити вихід?",
      text: (w) =>
        `Ви відмічені на роботі з ${w.uhrzeit}. Soll ніколи не відмічає вихід сам: додайте вихід, якщо ви вже пішли.`,
    },
    pause: {
      titel: "Час для перерви",
      text: (w) => `О ${w.uhrzeit} вам потрібна перерва ${w.minuten} хвилин (§ 4 ArbZG).`,
    },
    monat: {
      titel: "Підтвердіть місяць",
      text: (w) => `Будь ласка, перевірте й підтвердіть свій час за ${w.monat}.`,
    },
  },
  ar: {
    ausstempeln: {
      titel: "هل نسيت تسجيل الخروج؟",
      text: (w) =>
        `أنت مسجّل الدخول منذ ${w.uhrzeit}. لا يسجّل Soll خروجك تلقائيًا أبدًا: أضف وقت خروجك إن كنت قد غادرت.`,
    },
    pause: {
      titel: "حان وقت الاستراحة",
      text: (w) => `عند ${w.uhrzeit} تحتاج إلى استراحة مدتها ${w.minuten} دقيقة (§ 4 ArbZG).`,
    },
    monat: {
      titel: "أكّد شهرك",
      text: (w) => `يرجى مراجعة أوقاتك لشهر ${w.monat} وتأكيدها.`,
    },
  },
};

const uhrzeit = (sprache: Sprache, zeitpunkt: number) =>
  new Intl.DateTimeFormat(sprache, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Berlin",
  }).format(zeitpunkt);

/** "Oktober 2026": the 15th of the month at noon is in the month whatever the zone */
const monatsname = (sprache: Sprache, monat: string) =>
  new Intl.DateTimeFormat(sprache, {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(Date.parse(`${monat}-15T12:00:00Z`));

/** Where a tap leads: Heute for a shift, the month page (it opens on the last month) for the month */
export const zielVon = (e: Faellig): string => (e.art === "monat" ? "/monat" : "/");

export type Text = { titel: string; text: string };

export const textVon = (e: Faellig, sprache: Sprache): Text => {
  const vorlage = TEXTE[sprache][e.art];
  const werte: Werte = {
    uhrzeit: uhrzeit(sprache, e.art === "ausstempeln" ? e.seit : e.art === "pause" ? e.um : 0),
    minuten: e.art === "pause" ? e.minuten : 0,
    monat: e.art === "monat" ? monatsname(sprache, e.monat) : "",
  };
  return { titel: vorlage.titel, text: vorlage.text(werte) };
};

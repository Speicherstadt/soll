import type { Sprache } from "../erinnerungen/index.ts";
import type { TauschArt } from "./meldungen.ts";
import type { Vorlage } from "./texte.ts";

/*
 * The notifications of a shift swap (S-504) in the six languages of the app, the mail German as
 * every mail of Soll. They name the shift, never the colleague or a reason: the lock screen of a
 * phone is no place for either (Art. 5 Abs. 1 lit. c DSGVO).
 */

export const TAUSCH_TEXTE: Record<Sprache, Record<TauschArt, Vorlage>> = {
  de: {
    angeboten: {
      titel: "Schicht zum Tausch",
      text: (w) => `Dir wird eine Schicht angeboten: ${w.datum}, ${w.zeit}.`,
    },
    uebernommen: {
      titel: "Schicht übernommen",
      text: (w) => `Deine Schicht am ${w.datum}, ${w.zeit} ist übernommen und wartet auf Freigabe.`,
    },
    freigabe: {
      titel: "Tausch zur Freigabe",
      text: (w) => `Ein Tausch wartet auf deine Freigabe: ${w.datum}, ${w.zeit}.`,
    },
    freigegeben: {
      titel: "Tausch freigegeben",
      text: (w) => `Der Tausch der Schicht am ${w.datum}, ${w.zeit} ist freigegeben.`,
    },
    abgelehnt: {
      titel: "Tausch abgelehnt",
      text: (w) => `Der Tausch der Schicht am ${w.datum}, ${w.zeit} ist abgelehnt.`,
    },
    zurueckgezogen: {
      titel: "Angebot zurückgezogen",
      text: (w) => `Das Angebot der Schicht am ${w.datum}, ${w.zeit} ist zurückgezogen.`,
    },
  },
  en: {
    angeboten: {
      titel: "Shift offered",
      text: (w) => `A shift is offered to you: ${w.datum}, ${w.zeit}.`,
    },
    uebernommen: {
      titel: "Shift taken over",
      text: (w) => `Your shift on ${w.datum}, ${w.zeit} was taken over and awaits approval.`,
    },
    freigabe: {
      titel: "Swap to approve",
      text: (w) => `A swap awaits your approval: ${w.datum}, ${w.zeit}.`,
    },
    freigegeben: {
      titel: "Swap approved",
      text: (w) => `The swap of the shift on ${w.datum}, ${w.zeit} is approved.`,
    },
    abgelehnt: {
      titel: "Swap refused",
      text: (w) => `The swap of the shift on ${w.datum}, ${w.zeit} was refused.`,
    },
    zurueckgezogen: {
      titel: "Offer withdrawn",
      text: (w) => `The offer of the shift on ${w.datum}, ${w.zeit} was withdrawn.`,
    },
  },
  tr: {
    angeboten: {
      titel: "Takas için vardiya",
      text: (w) => `Sana bir vardiya teklif edildi: ${w.datum}, ${w.zeit}.`,
    },
    uebernommen: {
      titel: "Vardiya devralındı",
      text: (w) => `${w.datum}, ${w.zeit} vardiyan devralındı ve onay bekliyor.`,
    },
    freigabe: {
      titel: "Onay bekleyen takas",
      text: (w) => `Bir takas onayını bekliyor: ${w.datum}, ${w.zeit}.`,
    },
    freigegeben: {
      titel: "Takas onaylandı",
      text: (w) => `${w.datum}, ${w.zeit} vardiyasının takası onaylandı.`,
    },
    abgelehnt: {
      titel: "Takas reddedildi",
      text: (w) => `${w.datum}, ${w.zeit} vardiyasının takası reddedildi.`,
    },
    zurueckgezogen: {
      titel: "Teklif geri çekildi",
      text: (w) => `${w.datum}, ${w.zeit} vardiyası için teklif geri çekildi.`,
    },
  },
  pl: {
    angeboten: {
      titel: "Zmiana do wymiany",
      text: (w) => `Oferowana jest Ci zmiana: ${w.datum}, ${w.zeit}.`,
    },
    uebernommen: {
      titel: "Zmiana przejęta",
      text: (w) => `Twoja zmiana ${w.datum}, ${w.zeit} została przejęta i czeka na zatwierdzenie.`,
    },
    freigabe: {
      titel: "Wymiana do zatwierdzenia",
      text: (w) => `Wymiana czeka na Twoje zatwierdzenie: ${w.datum}, ${w.zeit}.`,
    },
    freigegeben: {
      titel: "Wymiana zatwierdzona",
      text: (w) => `Wymiana zmiany ${w.datum}, ${w.zeit} jest zatwierdzona.`,
    },
    abgelehnt: {
      titel: "Wymiana odrzucona",
      text: (w) => `Wymiana zmiany ${w.datum}, ${w.zeit} została odrzucona.`,
    },
    zurueckgezogen: {
      titel: "Oferta wycofana",
      text: (w) => `Oferta zmiany ${w.datum}, ${w.zeit} została wycofana.`,
    },
  },
  uk: {
    angeboten: {
      titel: "Зміна для обміну",
      text: (w) => `Вам пропонують зміну: ${w.datum}, ${w.zeit}.`,
    },
    uebernommen: {
      titel: "Зміну перейнято",
      text: (w) => `Вашу зміну ${w.datum}, ${w.zeit} перейнято, вона чекає на погодження.`,
    },
    freigabe: {
      titel: "Обмін на погодження",
      text: (w) => `Обмін чекає на ваше погодження: ${w.datum}, ${w.zeit}.`,
    },
    freigegeben: {
      titel: "Обмін погоджено",
      text: (w) => `Обмін зміни ${w.datum}, ${w.zeit} погоджено.`,
    },
    abgelehnt: {
      titel: "Обмін відхилено",
      text: (w) => `Обмін зміни ${w.datum}, ${w.zeit} відхилено.`,
    },
    zurueckgezogen: {
      titel: "Пропозицію відкликано",
      text: (w) => `Пропозицію зміни ${w.datum}, ${w.zeit} відкликано.`,
    },
  },
  ar: {
    angeboten: {
      titel: "مناوبة للتبديل",
      text: (w) => `عُرضت عليك مناوبة: ${w.datum}، ${w.zeit}.`,
    },
    uebernommen: {
      titel: "تم أخذ المناوبة",
      text: (w) => `أُخذت مناوبتك في ${w.datum}، ${w.zeit} وهي بانتظار الموافقة.`,
    },
    freigabe: {
      titel: "تبديل بانتظار الموافقة",
      text: (w) => `تبديل بانتظار موافقتك: ${w.datum}، ${w.zeit}.`,
    },
    freigegeben: {
      titel: "تمت الموافقة على التبديل",
      text: (w) => `تمت الموافقة على تبديل المناوبة في ${w.datum}، ${w.zeit}.`,
    },
    abgelehnt: {
      titel: "رُفض التبديل",
      text: (w) => `رُفض تبديل المناوبة في ${w.datum}، ${w.zeit}.`,
    },
    zurueckgezogen: {
      titel: "سُحب العرض",
      text: (w) => `سُحب عرض المناوبة في ${w.datum}، ${w.zeit}.`,
    },
  },
};

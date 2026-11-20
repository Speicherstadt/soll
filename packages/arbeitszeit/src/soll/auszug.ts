import type { KindKrankTag } from "../konten/kinderkrank.ts";
import type { GenommenerUrlaub } from "../urlaub/verfall.ts";
import type { TagesSoll } from "./tagessoll.ts";

/** The leave the days charge, for the leave account (`urlaubskonto`) */
export const urlaubGenommen = (tage: readonly TagesSoll[]): GenommenerUrlaub[] =>
  tage
    .filter((tag) => tag.urlaubHalbtage > 0)
    .map((tag) => ({ tag: tag.tag, halbtage: tag.urlaubHalbtage }));

/**
 * The working days with Kind krank per child, for `kinderkrankZaehlen`: § 45 Abs. 2 SGB V counts
 * Arbeitstage, so only days with Soll (no holiday, no day off in the model)
 */
export const kindKrankTage = (tage: readonly TagesSoll[]): KindKrankTag[] =>
  tage
    .filter((tag) => tag.sollMinuten > 0)
    .flatMap((tag) =>
      tag.abwesenheiten
        .filter((a) => a.art === "kind_krank")
        .map((a) => ({ tag: tag.tag, kind: a.kind ?? "" })),
    );

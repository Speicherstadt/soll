import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* The tables of the accounts (S-402); re-exported by ../schema.ts */

/**
 * A change of a person's accounts by hand, the only thing of them stored (docs/plan.md, "Konten"):
 * of the overtime account the balance when Soll begins (`startsaldo`), a payout (`auszahlung`) and a
 * correction (`korrektur`), each for a month in whole minutes; of the leave account the leave open
 * when Soll begins (`urlaub_start`, from that year on, counted as leave of the year before) and a
 * correction of a year (`urlaub_korrektur`), in half days; the leave open on a cut-off date
 * (`urlaub_stichtag`, S-708: for the month of that first day, in half days, the leave of its year
 * included). Every one with its reason; rows are only appended, a wrong one is corrected by another.
 * A start taken over from another tool carries the import, the tool and its id there (S-708).
 */
export const kontoAnpassungen = sqliteTable(
  "konto_anpassungen",
  {
    betriebId: text("betrieb_id").notNull(),
    anpassungId: text("anpassung_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    art: text("art", {
      enum: [
        "startsaldo",
        "auszahlung",
        "korrektur",
        "urlaub_start",
        "urlaub_korrektur",
        "urlaub_stichtag",
      ],
    }).notNull(),
    monat: text("monat"),
    jahr: integer("jahr"),
    minuten: integer("minuten"),
    halbtage: integer("halbtage"),
    grund: text("grund").notNull(),
    erstelltVon: text("erstellt_von").notNull(),
    erstelltAm: integer("erstellt_am").notNull(),
    importId: text("import_id"),
    externQuelle: text("extern_quelle"),
    externId: text("extern_id"),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.anpassungId] }),
    index("konto_anpassungen_person").on(t.betriebId, t.nutzerId),
    uniqueIndex("konto_anpassungen_extern").on(t.betriebId, t.externQuelle, t.externId),
  ],
);

/**
 * The day the business told a person which leave is open and when it expires (§ 7 Abs. 3 BUrlG;
 * EuGH C-684/16; BAG, 19.02.2019, 9 AZR 541/15): without it leave does not expire. `inhalt` is what
 * the notice named, as a JSON array of `{ jahr, halbtage, verfaelltAm }` (`verfallHinweis`), so the
 * person and the business can show what was said; `erstellt_am` when it was entered in Soll.
 */
export const urlaubshinweise = sqliteTable(
  "urlaubshinweise",
  {
    betriebId: text("betrieb_id").notNull(),
    hinweisId: text("hinweis_id").notNull(),
    nutzerId: text("nutzer_id").notNull(),
    tag: text("tag").notNull(),
    inhalt: text("inhalt").notNull(),
    erstelltVon: text("erstellt_von").notNull(),
    erstelltAm: integer("erstellt_am").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.betriebId, t.hinweisId] }),
    index("urlaubshinweise_person").on(t.betriebId, t.nutzerId, t.tag),
  ],
);

/** The 16 Länder by their ISO 3166-2 code without `DE-` */
export const LAENDER = [
  "BW",
  "BY",
  "BE",
  "BB",
  "HB",
  "HH",
  "HE",
  "MV",
  "NI",
  "NW",
  "RP",
  "SL",
  "SN",
  "ST",
  "SH",
  "TH",
] as const;

export type Land = (typeof LAENDER)[number];

/** The holiday law of each Land, named in every holiday it sets */
export const FEIERTAGSGESETZ: Record<Land, string> = {
  BW: "§ 1 FTG BW",
  BY: "Art. 1 BayFTG",
  BE: "§ 1 FeiertagsG Berlin",
  BB: "§ 2 FTG Brandenburg",
  HB: "§ 1 FeiertagsG Bremen",
  HH: "§ 1 FeiertagsG Hamburg",
  HE: "§ 1 HFeiertagsG",
  MV: "§ 2 FTG M-V",
  NI: "§ 2 NFeiertagsG",
  NW: "§ 2 FeiertagsG NW",
  RP: "§ 2 LFtG RP",
  SL: "§ 2 SFG Saarland",
  SN: "§ 1 SächsSFG",
  ST: "§ 2 FeiertG LSA",
  SH: "§ 2 SFTG Schleswig-Holstein",
  TH: "§ 2 ThürFtG",
};

/**
 * Holidays that hold only in some municipalities, by the law of their Land: the city of Augsburg
 * (Friedensfest, Art. 1 Abs. 2 BayFTG), predominantly catholic municipalities in Bavaria (Mariä
 * Himmelfahrt, Art. 1 Abs. 1 Nr. 2 BayFTG), and the municipalities in Saxony and Thuringia where
 * Fronleichnam is a holiday (§ 1 Abs. 2 SächsSFG with its ordinance, § 2 Abs. 2 ThürFtG).
 */
export const REGIONEN = {
  augsburg: "BY",
  katholisch: "BY",
  fronleichnam_sachsen: "SN",
  fronleichnam_thueringen: "TH",
} as const satisfies Record<string, Land>;

export type Region = keyof typeof REGIONEN;

/** Where people work: the Land and the regional holidays of the municipality */
export type Standort = { land: Land; regionen?: readonly Region[] };

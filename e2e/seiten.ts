/** Every page of the app with the message that titles it (the `pages` check reads the paths) */
export const SEITEN = [
  { pfad: "/", titel: "nav_heute" },
  { pfad: "/zeiten", titel: "nav_zeiten" },
  { pfad: "/abwesenheiten", titel: "nav_abwesenheiten" },
  { pfad: "/dienstplan", titel: "nav_dienstplan" },
  { pfad: "/projekte", titel: "nav_projekte" },
  { pfad: "/auswertungen", titel: "nav_auswertungen" },
  { pfad: "/einstellungen", titel: "nav_einstellungen" },
  { pfad: "/mehr", titel: "nav_mehr" },
] as const;

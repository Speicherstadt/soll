import crewmeister from "./crewmeister.json" with { type: "json" };
import papershift from "./papershift.json" with { type: "json" };
import planday from "./planday.json" with { type: "json" };

/*
 * Café Elbblick in Papershift, Planday and Crewmeister (BAULISTE.md S-706): the answers of their
 * APIs as the sources in each file describe them, for the readers' tests and the stand-ins of the
 * server. Not part of the package's main entry, so no app bundle carries them.
 */

export const ELBBLICK = { papershift, planday, crewmeister } as const;

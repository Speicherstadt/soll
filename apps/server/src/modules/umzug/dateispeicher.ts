import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, readFile, rename, rmdir, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/*
 * Files kept unchangeably under their SHA-256: the same content is the same file, a change shows when
 * it is read, and the hash in the row of the import names the content (BAULISTE.md S-701).
 *
 * Copied from firsttris/haben, packages/gobd-kern/src/dateispeicher.ts (commit b163e05), without a
 * dependency on it (CLAUDE.md, "Reference implementations"); left out is the check of all files,
 * which Soll does not use yet. Comments and messages translated into English.
 */

export const sha256Von = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export type Dateispeicher = {
  /** The path of a file by its hash: <verzeichnis>/ab/abcdef… */
  pfad: (sha256: string) => string;
  /** Keeps the file and returns its SHA-256 */
  speichern: (bytes: Uint8Array) => Promise<string>;
  /** Reads the file and checks its hash; a changed file throws */
  laden: (sha256: string) => Promise<Buffer>;
  /** Checks a file against its hash without loading it whole; other errors than a missing file throw */
  pruefen: (sha256: string) => Promise<"ok" | "fehlt" | "beschaedigt">;
  /** Removes a file by its hash; returns false if already missing */
  loeschen: (sha256: string) => Promise<boolean>;
};

/** `verzeichnis` is read at each access, so it may come from the environment late */
export const dateispeicher = (verzeichnis: () => string): Dateispeicher => {
  const pfad = (sha256: string): string => {
    if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("invalid hash");
    return join(resolve(verzeichnis()), sha256.slice(0, 2), sha256);
  };

  /** fsync of a folder, so the new name survives a crash; Windows refuses it (development only) */
  const ordnerSichern = async (ordner: string): Promise<void> => {
    if (process.platform === "win32") return;
    const handle = await open(ordner, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  };

  /**
   * Writes the file unless it lies there intact already: atomically through a temporary file, with
   * fsync, so after a crash no empty file stands under the hash
   */
  const speichern = async (bytes: Uint8Array): Promise<string> => {
    const sha256 = sha256Von(bytes);
    const ziel = pfad(sha256);
    const heil = await readFile(ziel).then(
      (vorhanden) => sha256Von(vorhanden) === sha256,
      () => false,
    );
    if (heil) return sha256;
    const ordner = dirname(ziel);
    await mkdir(ordner, { recursive: true });
    const temporaer = `${ziel}.${randomBytes(6).toString("hex")}.tmp`;
    const datei = await open(temporaer, "w", 0o640);
    try {
      await datei.writeFile(bytes);
      await datei.sync();
    } finally {
      await datei.close();
    }
    await rename(temporaer, ziel);
    await ordnerSichern(ordner);
    return sha256;
  };

  const laden = async (sha256: string): Promise<Buffer> => {
    const bytes = await readFile(pfad(sha256));
    if (sha256Von(bytes) !== sha256) throw new Error(`file ${sha256} is damaged`);
    return bytes;
  };

  const pruefen = async (sha256: string): Promise<"ok" | "fehlt" | "beschaedigt"> => {
    const hash = createHash("sha256");
    try {
      for await (const stueck of createReadStream(pfad(sha256))) hash.update(stueck as Buffer);
    } catch (fehler) {
      if ((fehler as NodeJS.ErrnoException).code === "ENOENT") return "fehlt";
      throw fehler;
    }
    return hash.digest("hex") === sha256 ? "ok" : "beschaedigt";
  };

  const loeschen = async (sha256: string): Promise<boolean> => {
    const ziel = pfad(sha256);
    try {
      await unlink(ziel);
    } catch (fehler) {
      if ((fehler as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw fehler;
    }
    await rmdir(dirname(ziel)).catch(() => {});
    return true;
  };

  return { pfad, speichern, laden, pruefen, loeschen };
};

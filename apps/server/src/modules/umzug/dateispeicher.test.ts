import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dateispeicher, sha256Von } from "./dateispeicher.ts";

// The cases of packages/gobd-kern/src/dateispeicher.test.ts in firsttris/haben, for the copy

let ordner: string;
beforeEach(async () => {
  ordner = await mkdtemp(join(tmpdir(), "soll-dateien-"));
});
afterEach(async () => {
  await rm(ordner, { recursive: true, force: true });
});

const inhalt = new TextEncoder().encode("Typ;Kennung;Person\nzeit;z-1;Sandra Kühn\n");

describe("the content-addressed file store", () => {
  it("keeps a file under its SHA-256 in a folder of its first two characters", async () => {
    const speicher = dateispeicher(() => ordner);
    const hash = await speicher.speichern(inhalt);
    expect(hash).toBe(sha256Von(inhalt));
    expect(speicher.pfad(hash)).toBe(join(ordner, hash.slice(0, 2), hash));
    expect(new Uint8Array(await readFile(speicher.pfad(hash)))).toEqual(inhalt);
  });

  it("gives the same hash for the same content and leaves the file there", async () => {
    const speicher = dateispeicher(() => ordner);
    const a = await speicher.speichern(inhalt);
    expect(await speicher.speichern(new Uint8Array(inhalt))).toBe(a);
    expect(new Uint8Array(await speicher.laden(a))).toEqual(inhalt);
  });

  it("finds a changed file when reading and replaces a damaged one when saving again", async () => {
    const speicher = dateispeicher(() => ordner);
    const hash = await speicher.speichern(inhalt);
    await writeFile(speicher.pfad(hash), "changed");
    await expect(speicher.laden(hash)).rejects.toThrow(`file ${hash} is damaged`);
    expect(await speicher.pruefen(hash)).toBe("beschaedigt");
    await speicher.speichern(inhalt);
    expect(await speicher.pruefen(hash)).toBe("ok");
    await rm(speicher.pfad(hash));
    expect(await speicher.pruefen(hash)).toBe("fehlt");
  });

  it("refuses anything but a SHA-256 in lower case, so no path leads out of the store", () => {
    const speicher = dateispeicher(() => ordner);
    expect(() => speicher.pfad("../../etc/passwd")).toThrow("invalid hash");
    expect(() => speicher.pfad("A".repeat(64))).toThrow("invalid hash");
  });

  it("removes a file and returns false when it is already gone", async () => {
    const speicher = dateispeicher(() => ordner);
    const hash = await speicher.speichern(inhalt);
    expect(await speicher.loeschen(hash)).toBe(true);
    expect(await speicher.pruefen(hash)).toBe("fehlt");
    expect(await speicher.loeschen(hash)).toBe(false);
  });
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";
import { computeSeenJobIds, loadSeenJobIds, saveSeenJobIds } from "./seenJobs.js";
import type { CleanJob } from "./types.js";

const buildJob = (id: string): CleanJob => ({
  id,
  title: `Puesto ${id}`,
  company: "Empresa",
  location: "CABA",
  url: "https://example.com",
  source: "Exactas UBA",
  tags: [],
  snippet: "",
});

describe("loadSeenJobIds / saveSeenJobIds", () => {
  let tempDir: string;
  let stateDir: URL;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "seen-jobs-"));
    stateDir = pathToFileURL(`${path.join(tempDir, "state")}${path.sep}`);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("devuelve un conjunto vacío si todavía no hay estado guardado", async () => {
    assert.deepEqual(await loadSeenJobIds("perfil.json", stateDir), new Set());
  });

  it("guarda los ids ordenados, creando la carpeta, y los vuelve a leer", async () => {
    await saveSeenJobIds("perfil.json", ["exactas-102/26", "exactas-101/26"], stateDir);

    assert.deepEqual(await loadSeenJobIds("perfil.json", stateDir), new Set(["exactas-101/26", "exactas-102/26"]));
    assert.equal(await readFile(new URL("perfil.json", stateDir), "utf-8"), '[\n  "exactas-101/26",\n  "exactas-102/26"\n]\n');
  });

  it("falla si el archivo de estado está corrupto, en vez de volver a notificar todo", async () => {
    await saveSeenJobIds("perfil.json", [], stateDir);
    await writeFile(new URL("perfil.json", stateDir), "{ roto");

    await assert.rejects(loadSeenJobIds("perfil.json", stateDir), SyntaxError);
  });

  it("falla si el archivo de estado no contiene una lista", async () => {
    await saveSeenJobIds("perfil.json", [], stateDir);
    await writeFile(new URL("perfil.json", stateDir), "{}");

    await assert.rejects(loadSeenJobIds("perfil.json", stateDir), /no es una lista/);
  });
});

describe("computeSeenJobIds", () => {
  const listedJobs = [buildJob("a"), buildJob("b"), buildJob("c")];

  it("conserva las ya vistas que siguen publicadas, suma las evaluadas y olvida las que ya no se publican", () => {
    const ids = computeSeenJobIds(listedJobs, new Set(["a", "vieja"]), new Set(["b"]), true);
    assert.deepEqual(ids, ["a", "b"]);
  });

  it("no olvida ninguna si alguna fuente no respondió", () => {
    const ids = computeSeenJobIds(listedJobs, new Set(["a", "de-fuente-caida"]), new Set(["b"]), false);
    assert.deepEqual(ids.sort(), ["a", "b", "de-fuente-caida"]);
  });
});

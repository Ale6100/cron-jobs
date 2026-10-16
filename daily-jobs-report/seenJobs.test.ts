import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";
import { computeSeenJobIds, consolidateCandidateJobs, loadSeenJobIds, saveSeenJobIds } from "./seenJobs.js";
import type { CleanJob } from "./types.js";

const buildJob = (id: string, overrides: Partial<CleanJob> = {}): CleanJob => ({
  id,
  title: `Puesto ${id}`,
  company: "Supermercado Coto",
  location: "CABA",
  url: `https://example.com/${id}`,
  source: "Exactas UBA",
  tags: [],
  snippet: "",
  ...overrides,
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

describe("consolidateCandidateJobs", () => {
  it("intercala las fuentes en orden round-robin y elimina duplicados por id o empresa+título", () => {
    const sourceA = [
      buildJob("bumeran-1", { company: "Farmacity S.A.", title: "Cajero/a de Sucursal" }),
      buildJob("bumeran-2", { company: "Coto", title: "Repositor" }),
    ];
    const sourceB = [
      buildJob("computrabajo-1", { company: "farmacity sa", title: "Cajero a de sucursal!" }),
      buildJob("computrabajo-2", { company: "Zara", title: "Vendedora" }),
    ];
    const sourceC = [
      buildJob("bumeran-1", { company: "Otra", title: "Otro" }),
      buildJob("linkedin-2", { company: "Havanna", title: "Atención al cliente" }),
    ];

    const consolidated = consolidateCandidateJobs([sourceA, sourceB, sourceC]);

    assert.deepEqual(consolidated.map((job) => job.id), [
      "bumeran-1",
      "bumeran-2",
      "computrabajo-2",
      "linkedin-2",
    ]);
  });

  it("no fusiona avisos cuando la empresa es genérica o confidencial ni cuando comparten una URL de listado como Exactas UBA", () => {
    const sharedUrl = "https://exactas.uba.ar/ofertas-de-trabajo-profesional/ofertas-activas-estudiantes/";
    const sourceA = [
      buildJob("exactas-101/26", { company: "Empresa no especificada", title: "Desarrollador", url: sharedUrl }),
      buildJob("exactas-102/26", { company: "Empresa no especificada", title: "Desarrollador", url: sharedUrl }),
    ];
    const sourceB = [
      buildJob("bumeran-1", { company: "Empresa confidencial", title: "Cajera" }),
      buildJob("computrabajo-1", { company: "Empresa confidencial", title: "Cajera" }),
    ];

    const consolidated = consolidateCandidateJobs([sourceA, sourceB]);

    assert.deepEqual(consolidated.map((job) => job.id), [
      "exactas-101/26",
      "bumeran-1",
      "exactas-102/26",
      "computrabajo-1",
    ]);
  });
});

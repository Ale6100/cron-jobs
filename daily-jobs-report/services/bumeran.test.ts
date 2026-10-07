import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch, silenceConsole } from "../../test-helpers/mockFetch.js";
import { fetchBumeranJobs, pickJobsAcrossQueries } from "./bumeran.js";

const buildJob = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  titulo: `Cajero ${id}`,
  detalle: "Atención al cliente &#x2615; y caja &amp; cobros",
  empresa: "Supermercado SA",
  confidencial: false,
  fechaPublicacion: "06-10-2026",
  tipoTrabajo: "Full-time",
  localizacion: "Capital Federal, Buenos Aires",
  modalidadTrabajo: "Presencial",
  ...overrides,
});

describe("pickJobsAcrossQueries", () => {
  it("mapea el aviso de Bumeran a una oferta limpia", () => {
    const [job] = pickJobsAcrossQueries([[buildJob(1)]]);

    assert.deepEqual(job, {
      id: "bumeran-1",
      title: "Cajero 1",
      company: "Supermercado SA",
      location: "Presencial (Capital Federal, Buenos Aires)",
      url: "https://www.bumeran.com.ar/empleos/1.html",
      source: "Bumeran",
      salary: "No especificado",
      publicationDate: "06-10-2026",
      tags: ["Full-time"],
      snippet: "Atención al cliente ☕ y caja & cobros",
    });
  });

  it("oculta el nombre de la empresa en avisos confidenciales", () => {
    const [job] = pickJobsAcrossQueries([[buildJob(1, { confidencial: true })]]);
    assert.equal(job?.company, "Empresa confidencial");
  });

  it("usa valores por defecto si el aviso no trae empresa, ubicación ni modalidad", () => {
    const [job] = pickJobsAcrossQueries([[buildJob(1, { empresa: undefined, localizacion: undefined, modalidadTrabajo: "Remoto" })]]);
    assert.equal(job?.company, "Empresa confidencial");
    assert.equal(job?.location, "Remoto (Argentina)");
  });

  it("descarta avisos presenciales fuera de Buenos Aires pero acepta remotos de cualquier lugar", () => {
    const jobs = pickJobsAcrossQueries([
      [
        buildJob(1, { localizacion: "Rosario, Santa Fe" }),
        buildJob(2, { localizacion: "Rosario, Santa Fe", modalidadTrabajo: "Remoto" }),
        buildJob(3, { localizacion: "Ramos Mejía, Buenos Aires", modalidadTrabajo: "Híbrido" }),
      ],
    ]);

    assert.deepEqual(jobs.map((job) => job.id), ["bumeran-2", "bumeran-3"]);
  });

  it("alterna entre búsquedas, elimina duplicados y respeta el tope de 20", () => {
    const cajeraResults = Array.from({ length: 20 }, (_, index) => buildJob(100 + index));
    const vendedoraResults = [buildJob(100), ...Array.from({ length: 19 }, (_, index) => buildJob(200 + index))];

    const jobs = pickJobsAcrossQueries([cajeraResults, vendedoraResults]);

    assert.equal(jobs.length, 20);
    assert.equal(new Set(jobs.map((job) => job.id)).size, 20);
    assert.deepEqual(jobs.slice(0, 3).map((job) => job.id), ["bumeran-100", "bumeran-101", "bumeran-200"]);
  });
});

describe("fetchBumeranJobs", () => {
  beforeEach(silenceConsole);
  afterEach(() => mock.restoreAll());

  it("consulta cada búsqueda y tolera que algunas fallen", async () => {
    const fetchMock = mockFetch((_url, init) => {
      const { query } = JSON.parse(String(init?.body)) as { query: string };
      if (query === "cajera") {
        return jsonResponse({ content: [buildJob(1)] });
      }
      return new Response("error", { status: 500 });
    });

    const jobs = await fetchBumeranJobs();

    assert.deepEqual(jobs.map((job) => job.id), ["bumeran-1"]);
    assert.equal(fetchMock.mock.callCount(), 6);
  });

  it("falla si todas las búsquedas fallan", async () => {
    mockFetch(() => new Response("error", { status: 403 }));
    await assert.rejects(fetchBumeranJobs(), /Fallaron todas las búsquedas en Bumeran/);
  });

  it("falla si la API cambia de formato y no trae el listado", async () => {
    mockFetch(() => jsonResponse({ results: [] }));
    await assert.rejects(fetchBumeranJobs(), /Fallaron todas las búsquedas en Bumeran/);
  });
});

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch, silenceConsole } from "../../test-helpers/mockFetch.js";
import {
  fetchFreehireJobs,
  filterAndMapFreehireJobs,
  isFreehireLocationCompatible,
  type FreehireJobItem,
} from "./freehire.js";

const buildFreehireJob = (slug: string, overrides: Partial<FreehireJobItem> = {}): FreehireJobItem => ({
  public_slug: slug,
  url: `https://example.com/jobs/${slug}`,
  title: "Full Stack &amp; React Developer",
  company: "Acme Corp",
  location: "Buenos Aires, Argentina",
  description: "<p>Buscamos desarrollador TypeScript &amp; React</p>",
  skills: ["react", "typescript"],
  work_mode: "remote",
  regions: ["latam"],
  countries: ["ar"],
  posted_at: "2026-10-15T10:00:00Z",
  enrichment: {
    seniority: "junior",
    salary_min: 2000,
    salary_max: 3000,
    salary_currency: "USD",
    salary_period: "month",
  },
  ...overrides,
});

describe("isFreehireLocationCompatible", () => {
  it("acepta ofertas remotas globales sin país restringido o que incluyan Argentina", () => {
    assert.equal(isFreehireLocationCompatible(buildFreehireJob("a", { work_mode: "remote", countries: [], location: "" })), true);
    assert.equal(isFreehireLocationCompatible(buildFreehireJob("b", { work_mode: "remote", countries: ["ar", "uy"] })), true);
  });

  it("descarta ofertas remotas restringidas exclusivamente a otros países de LATAM o regiones incompatibles", () => {
    assert.equal(isFreehireLocationCompatible(buildFreehireJob("a", { work_mode: "remote", countries: ["br"], location: "Brazil" })), false);
    assert.equal(isFreehireLocationCompatible(buildFreehireJob("b", { work_mode: "remote", countries: [], location: "US only" })), false);
  });

  it("en ofertas presenciales o híbridas exige Argentina y localidad compatible con Buenos Aires", () => {
    assert.equal(
      isFreehireLocationCompatible(buildFreehireJob("a", { work_mode: "hybrid", countries: ["ar"], location: "CABA, Argentina" })),
      true
    );
    assert.equal(
      isFreehireLocationCompatible(buildFreehireJob("b", { work_mode: "onsite", countries: ["ar"], location: "Córdoba, Argentina" })),
      false
    );
    assert.equal(
      isFreehireLocationCompatible(buildFreehireJob("c", { work_mode: "onsite", countries: ["co"], location: "Bogotá, Colombia" })),
      false
    );
  });
});

describe("filterAndMapFreehireJobs", () => {
  it("mapea una oferta válida decodificando entidades HTML y formateando el salario", () => {
    const [job] = filterAndMapFreehireJobs([buildFreehireJob("dev-1")]);

    assert.deepEqual(job, {
      id: "freehire-dev-1",
      title: "Full Stack & React Developer",
      company: "Acme Corp",
      location: "Remoto (Buenos Aires, Argentina)",
      url: "https://example.com/jobs/dev-1",
      source: "FreeHire",
      salary: "$2000 - $3000 USD/month",
      publicationDate: "2026-10-15T10:00:00Z",
      tags: ["react", "typescript"],
      snippet: "Buscamos desarrollador TypeScript & React",
    });
  });

  it("descarta seniorities altos, ofertas sin tecnologías afines y slugs duplicados", () => {
    const jobs = filterAndMapFreehireJobs([
      buildFreehireJob("jr-1", { enrichment: { seniority: "junior" } }),
      buildFreehireJob("jr-1", { enrichment: { seniority: "middle" } }),
      buildFreehireJob("sr-1", { enrichment: { seniority: "senior" } }),
      buildFreehireJob("lead-1", { enrichment: { seniority: "lead" } }),
      buildFreehireJob("cobol-1", { title: "Mainframe Developer", skills: ["cobol"], description: "AS400" }),
    ]);

    assert.deepEqual(jobs.map((job) => job.id), ["freehire-jr-1"]);
  });

  it("usa valores por defecto cuando faltan salario, empresa o URL", () => {
    const [job] = filterAndMapFreehireJobs([
      buildFreehireJob("min-1", {
        company: undefined,
        url: undefined,
        location: "",
        enrichment: undefined,
      }),
    ]);

    assert.equal(job?.company, "Empresa en FreeHire");
    assert.equal(job?.url, "https://freehire.me/jobs/min-1");
    assert.equal(job?.location, "Remoto (Global/LATAM)");
    assert.equal(job?.salary, "No especificado");
  });
});

describe("fetchFreehireJobs", () => {
  beforeEach(silenceConsole);
  afterEach(() => mock.restoreAll());

  it("combina las consultas de Argentina y remoto global/LATAM tolerando fallos parciales", async () => {
    let call = 0;
    mockFetch(() => {
      call++;
      if (call === 1) {
        return jsonResponse({ data: [buildFreehireJob("ar-1")] });
      }
      return new Response("error", { status: 502 });
    });

    const jobs = await fetchFreehireJobs();

    assert.deepEqual(jobs.map((job) => job.id), ["freehire-ar-1"]);
  });

  it("falla si todas las consultas a FreeHire fallan o devuelven formato inválido", async () => {
    mockFetch(() => jsonResponse({ wrong: [] }));
    await assert.rejects(fetchFreehireJobs(), /Fallaron todas las búsquedas en FreeHire/);
  });
});

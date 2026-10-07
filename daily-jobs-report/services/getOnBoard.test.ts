import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch } from "../../test-helpers/mockFetch.js";
import { fetchGetOnBoardJobs } from "./getOnBoard.js";

const buildJob = (id: string, attributes: Record<string, unknown> = {}) => ({
  id,
  type: "job",
  attributes: {
    title: "Frontend Developer",
    description: "<p>Trabajarás con <strong>React</strong> &amp; TypeScript</p>",
    remote: true,
    remote_modality: "fully_remote",
    countries: [],
    min_salary: 2000,
    max_salary: 3000,
    published_at: 1759708800,
    ...attributes,
  },
  links: { public_url: `https://www.getonbrd.com/jobs/${id}` },
});

describe("fetchGetOnBoardJobs", () => {
  afterEach(() => mock.restoreAll());

  it("mapea las ofertas remotas con stack afín", async () => {
    mockFetch(() => jsonResponse({ data: [buildJob("frontend-developer-buho-remote")] }));

    const [job] = await fetchGetOnBoardJobs();

    assert.deepEqual(job, {
      id: "frontend-developer-buho-remote",
      title: "Frontend Developer",
      company: "Buho",
      location: "Remoto (Global)",
      url: "https://www.getonbrd.com/jobs/frontend-developer-buho-remote",
      source: "Get on Board",
      salary: "$2000 - $3000 USD",
      publicationDate: "2025-10-06T00:00:00.000Z",
      tags: [],
      snippet: "Trabajarás con React & TypeScript",
    });
  });

  it("descarta ofertas presenciales fuera de Argentina y las de stack ajeno", async () => {
    mockFetch(() => jsonResponse({
      data: [
        buildJob("dev-chile-acme", { remote: false, countries: ["Chile"] }),
        buildJob("dev-arg-acme", { remote: false, countries: ["Argentina"] }),
        buildJob("rust-dev-acme-remote", { title: "Rust Engineer", description: "Sistemas embebidos en Rust" }),
      ],
    }));

    const jobs = await fetchGetOnBoardJobs();

    assert.deepEqual(jobs.map((job) => [job.id, job.location]), [["dev-arg-acme", "Presencial/Híbrido (Argentina)"]]);
  });

  it("indica los países de un remoto acotado y el salario mínimo cuando no hay máximo", async () => {
    mockFetch(() => jsonResponse({
      data: [buildJob("dev-acme-latam", { remote_modality: "remote_local", countries: ["Argentina", "Chile"], max_salary: null })],
    }));

    const [job] = await fetchGetOnBoardJobs();

    assert.equal(job?.location, "Remoto (Argentina, Chile)");
    assert.equal(job?.salary, "Desde $2000 USD");
  });

  it("usa un nombre genérico de empresa si el slug no permite deducirlo", async () => {
    mockFetch(() => jsonResponse({ data: [buildJob("frontend-remote")] }));

    const [job] = await fetchGetOnBoardJobs();

    assert.equal(job?.company, "Empresa en Get on Board");
  });

  it("propaga el error si la API no responde bien", async () => {
    mockFetch(() => new Response("error", { status: 500, statusText: "Server Error" }));
    await assert.rejects(fetchGetOnBoardJobs(), /Get on Board API respondió 500/);
  });
});

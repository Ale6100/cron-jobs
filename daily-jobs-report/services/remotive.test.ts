import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch } from "../../test-helpers/mockFetch.js";
import { fetchRemotiveJobs, isLocationCompatible } from "./remotive.js";

const buildJob = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  url: `https://remotive.com/remote-jobs/${id}`,
  title: "Full Stack Developer",
  company_name: "Acme",
  category: "Software Development",
  tags: ["node"],
  job_type: "full_time",
  publication_date: "2026-10-01T00:00:00",
  candidate_required_location: "Americas",
  salary: "",
  description: "<p>Node &amp; React</p>",
  ...overrides,
});

describe("isLocationCompatible", () => {
  it("acepta ubicaciones globales o que incluyen a Argentina", () => {
    for (const location of ["Worldwide", "Anywhere in the world", "LATAM", "Latin America", "Americas", "Argentina, Chile"]) {
      assert.equal(isLocationCompatible(location), true, location);
    }
  });

  it("descarta ubicaciones restringidas a un solo país o región", () => {
    for (const location of ["USA only", "UK Only", "Europe only (CET)"]) {
      assert.equal(isLocationCompatible(location), false, location);
    }
  });
});

describe("fetchRemotiveJobs", () => {
  afterEach(() => mock.restoreAll());

  it("mapea las ofertas afines y descarta las incompatibles", async () => {
    mockFetch(() => jsonResponse({
      jobs: [
        buildJob(1),
        buildJob(2, { candidate_required_location: "USA only" }),
        buildJob(3, { title: "Data Engineer", tags: ["spark"] }),
      ],
    }));

    const jobs = await fetchRemotiveJobs();

    assert.deepEqual(jobs, [{
      id: 1,
      title: "Full Stack Developer",
      company: "Acme",
      location: "Americas",
      url: "https://remotive.com/remote-jobs/1",
      source: "Remotive",
      salary: "No especificado",
      publicationDate: "2026-10-01T00:00:00",
      tags: ["node"],
      snippet: "Node & React",
    }]);
  });

  it("propaga el error si la API no responde bien", async () => {
    mockFetch(() => new Response("error", { status: 500, statusText: "Server Error" }));
    await assert.rejects(fetchRemotiveJobs(), /Remotive API respondió 500/);
  });
});

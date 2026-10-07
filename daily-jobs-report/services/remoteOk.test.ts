import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch } from "../../test-helpers/mockFetch.js";
import { fetchRemoteOkJobs } from "./remoteOk.js";

const buildJob = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  position: "Senior Frontend Engineer",
  company: "Acme",
  location: "Worldwide",
  tags: ["react", "typescript"],
  url: `https://remoteok.com/remote-jobs/${id}`,
  description: "<p>Build UIs</p>",
  date: "2026-10-01T00:00:00+00:00",
  salary_min: 60000,
  salary_max: 90000,
  ...overrides,
});

describe("fetchRemoteOkJobs", () => {
  afterEach(() => mock.restoreAll());

  it("ignora el aviso legal inicial y mapea las ofertas afines", async () => {
    mockFetch(() => jsonResponse([{ legal: "API Terms of Service" }, buildJob("1")]));

    const jobs = await fetchRemoteOkJobs();

    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.id, "remoteok-1");
    assert.match(jobs[0]?.salary ?? "", /^\$60[.,]000 - \$90[.,]000 USD$/);
    assert.equal(jobs[0]?.snippet, "Build UIs");
  });

  it("trata la ubicación vacía como Worldwide", async () => {
    mockFetch(() => jsonResponse([buildJob("1", { location: "" })]));

    const [job] = await fetchRemoteOkJobs();

    assert.equal(job?.location, "Remoto (Worldwide)");
  });

  it("descarta ofertas restringidas a un país y las de stack ajeno", async () => {
    mockFetch(() => jsonResponse([
      buildJob("1", { location: "USA only" }),
      buildJob("2", { position: "Golang Engineer", tags: ["go"] }),
      buildJob("3", { location: "LATAM" }),
    ]));

    const jobs = await fetchRemoteOkJobs();

    assert.deepEqual(jobs.map((job) => job.id), ["remoteok-3"]);
  });

  it("propaga el error si la API no responde bien", async () => {
    mockFetch(() => new Response("error", { status: 429, statusText: "Too Many Requests" }));
    await assert.rejects(fetchRemoteOkJobs(), /RemoteOK API respondió 429/);
  });
});

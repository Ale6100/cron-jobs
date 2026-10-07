import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch, silenceConsole } from "../../test-helpers/mockFetch.js";
import type { CleanJob } from "../types.js";
import { describeQuotaError, evaluateJobsWithGemini, fetchAvailableGeminiModels } from "./gemini.js";

const buildCleanJob = (id: string): CleanJob => ({
  id,
  title: `Puesto ${id}`,
  company: "Empresa",
  location: "Capital Federal",
  url: `https://example.com/${id}`,
  source: "Bumeran",
  tags: [],
  snippet: "Descripción",
});

const geminiResponse = (matches: unknown[]): Response => jsonResponse({
  candidates: [{ content: { parts: [{ text: JSON.stringify({ matches }) }] } }],
});

const buildMatch = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Puesto ${id}`,
  company: "Empresa",
  url: "",
  location: "",
  score: 8,
  reason: "Encaja",
  isMatch: true,
  estimatedPay: 600000,
  ...overrides,
});

describe("describeQuotaError", () => {
  it("resume los límites agotados y la espera sugerida por Google", () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        message: "You exceeded your current quota...",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier", quotaValue: "10" }],
          },
          { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "23s" },
        ],
      },
    });

    assert.equal(describeQuotaError(body), "GenerateRequestsPerMinutePerProjectPerModel-FreeTier = 10; reintentar en 23s");
  });

  it("usa el mensaje del error si no trae el detalle de la cuota", () => {
    assert.equal(describeQuotaError(JSON.stringify({ error: { message: "Resource exhausted" } })), "Resource exhausted");
  });

  it("devuelve el texto crudo si la respuesta no es JSON", () => {
    assert.equal(describeQuotaError("Too Many Requests"), "Too Many Requests");
  });
});

describe("fetchAvailableGeminiModels", () => {
  beforeEach(silenceConsole);
  afterEach(() => mock.restoreAll());

  it("prueba todos los Flash de versión 3 o superior antes que los Flash-Lite, y estos antes que los Pro", async () => {
    mockFetch(() => jsonResponse({
      models: [
        "gemini-3.1-pro-preview",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite-preview",
        "gemini-3.1-flash-lite",
        "gemini-3-flash-preview",
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
      ].map((name) => ({ name: `models/${name}`, supportedGenerationMethods: ["generateContent"] })),
    }));

    assert.deepEqual(await fetchAvailableGeminiModels("key"), [
      "gemini-3.5-flash",
      "gemini-3-flash-preview",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.1-flash-lite-preview",
      "gemini-3.1-pro-preview",
    ]);
  });

  it("prioriza modelos Flash y luego la versión más nueva, descartando modelos no aptos", async () => {
    mockFetch(() => jsonResponse({
      models: [
        { name: "models/gemini-3.5-pro", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3.5-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3.7-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3.7-flash-tts", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["embedContent"] },
      ],
    }));

    assert.deepEqual(await fetchAvailableGeminiModels("key"), ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-pro"]);
  });

  it("usa la lista de respaldo si la API no ofrece ningún modelo apto", async () => {
    mockFetch(() => jsonResponse({ models: [{ name: "models/gemini-2.0-flash", supportedGenerationMethods: ["generateContent"] }] }));
    assert.deepEqual(await fetchAvailableGeminiModels("key"), ["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.8-flash"]);
  });

  it("usa la lista de respaldo si no puede consultar los modelos", async () => {
    mockFetch(() => new Response("error", { status: 500 }));
    assert.deepEqual(await fetchAvailableGeminiModels("key"), ["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.8-flash"]);
  });
});

describe("evaluateJobsWithGemini", () => {
  const originalGeminiModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    silenceConsole();
    delete process.env.GEMINI_MODEL;
  });
  afterEach(() => {
    mock.restoreAll();
    if (originalGeminiModel === undefined) {
      delete process.env.GEMINI_MODEL;
    } else {
      process.env.GEMINI_MODEL = originalGeminiModel;
    }
  });

  it("no consulta a Gemini si no hay ofertas", async () => {
    const fetchMock = mockFetch(() => geminiResponse([]));

    assert.deepEqual(await evaluateJobsWithGemini([], "criterios", "key"), []);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("envía los criterios del perfil y devuelve solo las ofertas afines que existen", async () => {
    process.env.GEMINI_MODEL = "gemini-test";
    const fetchMock = mockFetch(() => geminiResponse([
      buildMatch("a", { score: 7 }),
      buildMatch("b", { score: 9, estimatedPay: null }),
      buildMatch("c", { score: 6 }),
      buildMatch("d", { isMatch: false }),
      buildMatch("inventada"),
    ]));

    const matches = await evaluateJobsWithGemini(
      ["a", "b", "c", "d"].map(buildCleanJob),
      "CRITERIOS DEL PERFIL",
      "key"
    );

    assert.deepEqual(matches.map((match) => [match.id, match.score, match.estimatedPay]), [["b", 9, null], ["a", 7, 600000]]);
    assert.deepEqual(matches.map((match) => [match.url, match.location, match.source]), [
      ["https://example.com/b", "Capital Federal", "Bumeran"],
      ["https://example.com/a", "Capital Federal", "Bumeran"],
    ]);

    const [url, init] = fetchMock.mock.calls[0]?.arguments ?? [];
    assert.match(String(url), /models\/gemini-test:generateContent/);
    assert.match(String(init?.body), /CRITERIOS DEL PERFIL/);
  });

  it("pasa al siguiente modelo si uno no tiene cuota o no existe", async () => {
    const requestedModels: string[] = [];
    mockFetch((url) => {
      if (!url.includes(":generateContent")) {
        return jsonResponse({
          models: ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"].map((name) => ({
            name: `models/${name}`,
            supportedGenerationMethods: ["generateContent"],
          })),
        });
      }
      const model = url.match(/models\/([^:]+):generateContent/)?.[1] ?? "";
      requestedModels.push(model);
      if (model === "gemini-3.8-flash") return new Response("quota", { status: 429 });
      if (model === "gemini-3.7-flash") return new Response("not found", { status: 404 });
      return geminiResponse([buildMatch("a")]);
    });

    const matches = await evaluateJobsWithGemini([buildCleanJob("a")], "criterios", "key");

    assert.deepEqual(requestedModels, ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]);
    assert.equal(matches.length, 1);
  });

  it("solo evalúa las primeras 35 ofertas y compara ids numéricos con los que devuelve Gemini como texto", async () => {
    process.env.GEMINI_MODEL = "gemini-test";
    const jobs = Array.from({ length: 40 }, (_, index): CleanJob => ({ ...buildCleanJob(""), id: index }));
    const fetchMock = mockFetch(() => geminiResponse([buildMatch("3"), buildMatch("38")]));

    const matches = await evaluateJobsWithGemini(jobs, "criterios", "key");

    assert.deepEqual(matches.map((match) => String(match.id)), ["3"]);
    const prompt = String(fetchMock.mock.calls[0]?.arguments[1]?.body);
    assert.match(prompt, /\\"id\\": 34,/);
    assert.doesNotMatch(prompt, /\\"id\\": 35,/);
  });

  it("devuelve una lista vacía si Gemini responde sin contenido o con JSON inválido", async () => {
    process.env.GEMINI_MODEL = "gemini-test";

    mockFetch(() => jsonResponse({ candidates: [] }));
    assert.deepEqual(await evaluateJobsWithGemini([buildCleanJob("a")], "criterios", "key"), []);

    mock.restoreAll();
    silenceConsole();
    mockFetch(() => jsonResponse({ candidates: [{ content: { parts: [{ text: "no es json" }] } }] }));
    assert.deepEqual(await evaluateJobsWithGemini([buildCleanJob("a")], "criterios", "key"), []);
  });

  it("falla con el último error si ningún modelo responde", async () => {
    process.env.GEMINI_MODEL = "gemini-test";
    mockFetch(() => new Response("bad request", { status: 400 }));

    await assert.rejects(
      evaluateJobsWithGemini([buildCleanJob("a")], "criterios", "key"),
      /Gemini API respondió 400: bad request/
    );
  });
});

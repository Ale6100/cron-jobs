import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch, silenceConsole } from "../../test-helpers/mockFetch.js";
import { getDolarPrice } from "./dolar.js";

describe("getDolarPrice", () => {
  beforeEach(silenceConsole);
  afterEach(() => mock.restoreAll());

  it("devuelve el precio de venta del dólar blue", async () => {
    mockFetch(() => jsonResponse({ compra: 1400, venta: 1450 }));
    assert.equal(await getDolarPrice(), 1450);
  });

  it("usa el valor de respaldo si la API falla", async () => {
    mockFetch(() => new Response("error", { status: 503 }));
    assert.equal(await getDolarPrice(), 1500);
  });

  it("usa el valor de respaldo si la API no trae un precio válido", async () => {
    mockFetch(() => jsonResponse({ venta: 0 }));
    assert.equal(await getDolarPrice(), 1500);
  });
});

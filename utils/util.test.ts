import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPrice } from "./util.js";

describe("formatPrice", () => {
  it("formatea en pesos argentinos con decimales", () => {
    assert.match(formatPrice(1234.5), /^\$\s1\.234,50$/);
  });

  it("puede omitir los decimales", () => {
    assert.match(formatPrice(1234.5, false), /^\$\s1\.235$/);
  });
});

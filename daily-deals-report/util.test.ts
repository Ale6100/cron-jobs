import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanUrl } from "./util.js";

describe("cleanUrl", () => {
  it("quita parámetros y anclas de la URL", () => {
    assert.equal(cleanUrl("https://www.fravega.com/p/heladera-123/?sku=1&utm=x#reviews"), "https://www.fravega.com/p/heladera-123/");
  });

  it("devuelve el texto original si no es una URL válida", () => {
    assert.equal(cleanUrl("/p/relativa?x=1"), "/p/relativa?x=1");
  });
});

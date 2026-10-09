import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitIntoMessages } from "./message.js";

describe("splitIntoMessages", () => {
  it("arma un solo mensaje si todo entra en el límite", () => {
    assert.deepEqual(splitIntoMessages("H", ["a", "b"], 10), ["Hab"]);
  });

  it("parte entre ofertas sin cortar ninguna y deja el encabezado solo en el primero", () => {
    assert.deepEqual(splitIntoMessages("HH", ["aaaa", "bbbb", "cccc"], 10), ["HHaaaabbbb", "cccc"]);
  });

  it("no deja el encabezado solo aunque la primera oferta supere el límite", () => {
    assert.deepEqual(splitIntoMessages("HH", ["aaaaaaaaaa", "b"], 10), ["HHaaaaaaaaaa", "b"]);
  });
});

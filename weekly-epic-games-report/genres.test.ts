import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch } from "../test-helpers/mockFetch.js";
import { fetchGameGenres } from "./genres.js";

describe("fetchGameGenres", () => {
  afterEach(() => mock.restoreAll());

  it("obtiene géneros en español desde Steam por título", async () => {
    mockFetch((url) => {
      if (url.includes("storesearch")) {
        return jsonResponse({ items: [{ id: 12345, name: "Flotsam" }] });
      }
      if (url.includes("appdetails")) {
        return jsonResponse({
          12345: {
            data: {
              genres: [
                { id: "1", description: "Indie" },
                { id: "28", description: "Simuladores" },
                { id: "2", description: "Estrategia" },
              ],
            },
          },
        });
      }
      throw new Error(`URL no esperada: ${url}`);
    });

    const genres = await fetchGameGenres("Flotsam");
    assert.deepEqual(genres, ["Indie", "Simuladores", "Estrategia"]);
  });

  it("busca por slug si el título exacto no devuelve resultados en Steam", async () => {
    mockFetch((url) => {
      if (url.includes("storesearch") && url.includes("idle")) {
        return jsonResponse({ items: [{ id: 999, name: "Idle Champions of the Forgotten Realms" }] });
      }
      if (url.includes("storesearch")) {
        return jsonResponse({ items: [] });
      }
      if (url.includes("appdetails")) {
        return jsonResponse({
          999: {
            data: {
              genres: [
                { id: "1", description: "Acción" },
                { id: "2", description: "Aventura" },
                { id: "37", description: "Free to Play" },
              ],
            },
          },
        });
      }
      throw new Error(`URL no esperada: ${url}`);
    });

    const genres = await fetchGameGenres("Idle Champions de Forgotten Realms", "idle-champions-of-the-forgotten-realms");
    assert.deepEqual(genres, ["Acción", "Aventura"]);
  });

  it("devuelve array vacío si el juego no existe o falla la red", async () => {
    mockFetch(() => jsonResponse({ items: [] }));
    const genres = await fetchGameGenres("Juego Inexistente");
    assert.deepEqual(genres, []);
  });
});

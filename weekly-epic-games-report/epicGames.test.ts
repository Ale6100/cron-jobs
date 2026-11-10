import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch } from "../test-helpers/mockFetch.js";
import { fetchEpicFreeGames, getEpicStoreUrl, parseEpicFreeGames } from "./epicGames.js";
import type { EpicGamesApiResponse } from "./types.js";

describe("parseEpicFreeGames", () => {
  const fixedNow = new Date("2026-11-10T15:00:00.000Z");

  it("incluye juegos que eran pagos y ahora tienen promoción 100% activa", () => {
    const mockData: EpicGamesApiResponse = {
      data: {
        Catalog: {
          searchStore: {
            elements: [
              {
                title: "Paid Game Now Free",
                description: "Un juego de aventura.",
                price: {
                  totalPrice: {
                    originalPrice: 1999,
                    discountPrice: 0,
                    fmtPrice: { originalPrice: "19,99 US$", discountPrice: "0" },
                  },
                },
                offerMappings: [{ pageSlug: "paid-game-now-free", pageType: "productHome" }],
                promotions: {
                  promotionalOffers: [
                    {
                      promotionalOffers: [
                        {
                          startDate: "2026-11-05T16:00:00.000Z",
                          endDate: "2026-11-12T16:00:00.000Z",
                          discountSetting: { discountPercentage: 0 },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    };

    const report = parseEpicFreeGames(mockData, fixedNow);

    assert.equal(report.currentGames.length, 1);
    assert.equal(report.currentGames[0]?.title, "Paid Game Now Free");
    assert.equal(report.currentGames[0]?.originalPrice, "19,99 US$");
    assert.equal(report.currentGames[0]?.url, "https://store.epicgames.com/es-ES/p/paid-game-now-free");
    assert.equal(report.upcomingGames.length, 0);
  });

  it("incluye paquetes promocionales en juegos free-to-play activos", () => {
    const mockData: EpicGamesApiResponse = {
      data: {
        Catalog: {
          searchStore: {
            elements: [
              {
                title: "Idle Champions de Forgotten Realms",
                price: {
                  totalPrice: {
                    originalPrice: 0,
                    discountPrice: 0,
                    fmtPrice: { originalPrice: "0", discountPrice: "0" },
                  },
                },
                productSlug: "idle-champions-of-the-forgotten-realms",
                promotions: {
                  promotionalOffers: [
                    {
                      promotionalOffers: [
                        {
                          startDate: "2026-11-05T16:00:00.000Z",
                          endDate: "2026-11-12T16:00:00.000Z",
                          discountSetting: { discountPercentage: 0 },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    };

    const report = parseEpicFreeGames(mockData, fixedNow);

    assert.equal(report.currentGames.length, 1);
    assert.equal(report.currentGames[0]?.title, "Idle Champions de Forgotten Realms");
    assert.equal(report.currentGames[0]?.originalPrice, "Free-to-play");
    assert.equal(report.currentGames[0]?.slug, "idle-champions-of-the-forgotten-realms");
  });

  it("ignora juegos del catálogo que no tienen promociones activas", () => {
    const mockData: EpicGamesApiResponse = {
      data: {
        Catalog: {
          searchStore: {
            elements: [
              {
                title: "Standard Catalog Game",
                price: {
                  totalPrice: {
                    originalPrice: 2000,
                    discountPrice: 2000,
                  },
                },
                promotions: null,
              },
            ],
          },
        },
      },
    };

    const report = parseEpicFreeGames(mockData, fixedNow);

    assert.equal(report.currentGames.length, 0);
    assert.equal(report.upcomingGames.length, 0);
  });

  it("ignora juegos con descuento parcial que no son 100% gratis", () => {
    const mockData: EpicGamesApiResponse = {
      data: {
        Catalog: {
          searchStore: {
            elements: [
              {
                title: "Discounted Game",
                price: {
                  totalPrice: {
                    originalPrice: 2000,
                    discountPrice: 1000,
                    fmtPrice: { originalPrice: "20,00 US$", discountPrice: "10,00 US$" },
                  },
                },
                promotions: {
                  promotionalOffers: [
                    {
                      promotionalOffers: [
                        {
                          startDate: "2026-11-05T16:00:00.000Z",
                          endDate: "2026-11-12T16:00:00.000Z",
                          discountSetting: { discountPercentage: 50 },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    };

    const report = parseEpicFreeGames(mockData, fixedNow);

    assert.equal(report.currentGames.length, 0);
  });

  it("clasifica como próximos los juegos pagos con promoción futura al 100%", () => {
    const mockData: EpicGamesApiResponse = {
      data: {
        Catalog: {
          searchStore: {
            elements: [
              {
                title: "Next Week Free Game",
                price: {
                  totalPrice: {
                    originalPrice: 1500,
                    discountPrice: 1500,
                    fmtPrice: { originalPrice: "15,00 US$" },
                  },
                },
                productSlug: "next-week-game",
                promotions: {
                  upcomingPromotionalOffers: [
                    {
                      promotionalOffers: [
                        {
                          startDate: "2026-11-12T16:00:00.000Z",
                          endDate: "2026-11-19T16:00:00.000Z",
                          discountSetting: { discountPercentage: 0 },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    };

    const report = parseEpicFreeGames(mockData, fixedNow);

    assert.equal(report.currentGames.length, 0);
    assert.equal(report.upcomingGames.length, 1);
    assert.equal(report.upcomingGames[0]?.title, "Next Week Free Game");
    assert.equal(report.upcomingGames[0]?.url, "https://store.epicgames.com/es-ES/p/next-week-game");
  });

  it("ignora promociones vencidas", () => {
    const mockData: EpicGamesApiResponse = {
      data: {
        Catalog: {
          searchStore: {
            elements: [
              {
                title: "Expired Promo Game",
                price: {
                  totalPrice: {
                    originalPrice: 1000,
                    discountPrice: 1000,
                  },
                },
                promotions: {
                  promotionalOffers: [
                    {
                      promotionalOffers: [
                        {
                          startDate: "2026-10-01T16:00:00.000Z",
                          endDate: "2026-10-08T16:00:00.000Z",
                          discountSetting: { discountPercentage: 0 },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    };

    const report = parseEpicFreeGames(mockData, fixedNow);
    assert.equal(report.currentGames.length, 0);
  });
});

describe("getEpicStoreUrl", () => {
  it("respeta la URL explícita si el elemento la provee", () => {
    assert.equal(
      getEpicStoreUrl({ title: "Custom URL", url: "https://custom.epicgames.com/game" }),
      "https://custom.epicgames.com/game"
    );
  });

  it("usa offerMappings antes que urlSlug", () => {
    assert.equal(
      getEpicStoreUrl({
        title: "Mapped Game",
        urlSlug: "random-hash-123",
        offerMappings: [{ pageSlug: "slug-bonito", pageType: "productHome" }],
      }),
      "https://store.epicgames.com/es-ES/p/slug-bonito"
    );
  });

  it("devuelve la página general de free-games si no encuentra slug", () => {
    assert.equal(getEpicStoreUrl({ title: "No Slug Game" }), "https://store.epicgames.com/es-ES/free-games");
  });
});

describe("fetchEpicFreeGames", () => {
  afterEach(() => mock.restoreAll());

  it("falla si la API devuelve error HTTP", async () => {
    mockFetch(() => jsonResponse({ error: "server error" }, 500));

    await assert.rejects(() => fetchEpicFreeGames(), /Epic Games API respondió 500/);
  });
});

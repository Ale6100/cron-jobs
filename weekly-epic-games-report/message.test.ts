import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeMarkdown, formatEpicDate, formatWeeklyEpicGamesMessage } from "./message.js";
import type { EpicFreeGamesReport } from "./types.js";

describe("escapeMarkdown", () => {
  it("escapa caracteres de formato Markdown", () => {
    assert.equal(escapeMarkdown("Juego *Pro* _Deluxe_ [DLC] `test`"), "Juego \\*Pro\\* \\_Deluxe\\_ \\[DLC\\] \\`test\\`");
  });
});

describe("formatEpicDate", () => {
  it("formatea la fecha en hora de Argentina con día y horario", () => {
    const formatted = formatEpicDate("2026-11-12T16:00:00.000Z");
    assert.match(formatted, /12 de noviembre/);
    assert.match(formatted, /13:00 hs/);
  });
});

describe("formatWeeklyEpicGamesMessage", () => {
  it("arma el mensaje con los juegos activos, sus géneros (sin descripción) y los próximos", () => {
    const report: EpicFreeGamesReport = {
      currentGames: [
        {
          title: "Flotsam",
          originalPrice: "4,99 US$",
          url: "https://store.epicgames.com/es-ES/p/flotsam-266287",
          startDate: "2026-11-05T16:00:00.000Z",
          endDate: "2026-11-12T16:00:00.000Z",
          genres: ["Indie", "Simuladores", "Estrategia"],
        },
        {
          title: "Idle Champions de Forgotten Realms",
          originalPrice: "Free-to-play",
          url: "https://store.epicgames.com/es-ES/p/idle-champions-of-the-forgotten-realms",
          startDate: "2026-11-05T16:00:00.000Z",
          endDate: "2026-11-12T16:00:00.000Z",
          genres: ["Acción", "Aventura"],
        },
      ],
      upcomingGames: [
        {
          title: "Knightica",
          originalPrice: "6,69 US$",
          url: "https://store.epicgames.com/es-ES/p/knightica-3be45c",
          startDate: "2026-11-12T16:00:00.000Z",
          endDate: "2026-11-19T16:00:00.000Z",
          genres: ["Estrategia"],
        },
      ],
    };

    const message = formatWeeklyEpicGamesMessage(report);

    assert.match(message, /JUEGOS GRATIS DE LA SEMANA \(EPIC GAMES\)/);
    assert.match(message, /🕹️ \*Flotsam\*/);
    assert.match(message, /4,99 US\$/);
    assert.match(message, /🏷️ \*Géneros:\* Indie, Simuladores, Estrategia/);
    assert.match(message, /🕹️ \*Idle Champions de Forgotten Realms\*/);
    assert.match(message, /Pack promocional temporal gratis/);
    assert.match(message, /🏷️ \*Géneros:\* Acción, Aventura/);
    assert.doesNotMatch(message, /Sobrevive en una ciudad flotante/);
    assert.match(message, /Próximamente gratis/);
    assert.match(message, /Knightica.*Estrategia/);
  });

  it("devuelve mensaje informativo si no hay juegos gratuitos activos", () => {
    const report: EpicFreeGamesReport = {
      currentGames: [],
      upcomingGames: [],
    };

    const message = formatWeeklyEpicGamesMessage(report);
    assert.match(message, /No se detectaron juegos gratis esta semana/);
  });
});

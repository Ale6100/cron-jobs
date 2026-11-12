import type { CleanFreeGame, EpicFreeGamesReport } from "./types.js";

export const escapeMarkdown = (text: string): string => text.replace(/([_*`[\]])/g, "\\$1");

export const formatEpicDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  const formattedDay = date.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const formattedTime = date.toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${formattedDay} a las ${formattedTime} hs`;
};

const formatPriceLine = (game: CleanFreeGame): string => {
  if (game.originalPrice === "Free-to-play") {
    return "💵 *Precio habitual:* Free-to-play (*Pack promocional temporal gratis*)";
  }
  return `💵 *Precio habitual:* ${escapeMarkdown(game.originalPrice)} (*100% GRATIS*)`;
};

const formatGenresLine = (genres: string[]): string => {
  if (genres.length === 0) {
    return "";
  }
  return `🏷️ *Géneros:* ${escapeMarkdown(genres.join(", "))}\n`;
};

const formatCurrentGameItem = (game: CleanFreeGame): string => {
  return `🕹️ *${escapeMarkdown(game.title)}*
${formatPriceLine(game)}
${formatGenresLine(game.genres)}📅 *Disponible gratis hasta:* ${formatEpicDate(game.endDate)}
🔗 ${escapeMarkdown(game.url)}`;
};

const formatUpcomingDetails = (game: CleanFreeGame): string => {
  const price = game.originalPrice === "Free-to-play" ? "Free-to-play" : `habitual: ${game.originalPrice}`;
  const genres = game.genres.length > 0 ? ` | ${game.genres.join(", ")}` : "";
  return `${price}${genres}`;
};

export const formatWeeklyEpicGamesMessage = (report: EpicFreeGamesReport): string => {
  const { currentGames, upcomingGames } = report;

  if (currentGames.length === 0) {
    return "🎮 *JUEGOS GRATIS DE LA SEMANA (EPIC GAMES)*\n\nNo se detectaron juegos gratis esta semana en Epic Games.";
  }

  const SEPARATOR = "\n━━━━━━━━━━━━━━━━\n";
  const header = "🎮 *JUEGOS GRATIS DE LA SEMANA (EPIC GAMES)*\n_Promociones activas por tiempo limitado_\n";

  const currentSection = currentGames.map((game) => `${SEPARATOR}${formatCurrentGameItem(game)}`).join("");

  let upcomingSection = "";
  if (upcomingGames.length > 0) {
    const upcomingList = upcomingGames
      .map(
        (game) =>
          `• *${escapeMarkdown(game.title)}* (${escapeMarkdown(formatUpcomingDetails(game))}) — desde el ${formatEpicDate(game.startDate)}`
      )
      .join("\n");

    upcomingSection = `${SEPARATOR}🔜 *Próximamente gratis:*\n${upcomingList}\n`;
  }

  return `${header}${currentSection}${upcomingSection}`;
};

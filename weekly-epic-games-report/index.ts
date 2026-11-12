import { sendMessageTelegram } from "../utils/sendMessage.js";
import { escapeMarkdown, getGitHubRunUrl } from "../utils/util.js";
import { fetchEpicFreeGames } from "./epicGames.js";
import { formatWeeklyEpicGamesMessage } from "./message.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Faltan variables de entorno necesarias para ejecutar weekly-epic-games-report (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)");
  process.exit(1);
}

const main = async () => {
  try {
    console.log("Consultando juegos gratuitos en Epic Games Store...");
    const report = await fetchEpicFreeGames();

    console.log(`Juegos gratuitos activos encontrados: ${report.currentGames.length}`);
    console.log(`Juegos gratuitos próximos encontrados: ${report.upcomingGames.length}`);

    const message = formatWeeklyEpicGamesMessage(report);

    await sendMessageTelegram({
      token: TELEGRAM_BOT_TOKEN,
      chatId: TELEGRAM_CHAT_ID,
      text: message,
    });

    console.log("Mensaje de juegos gratuitos de Epic Games enviado exitosamente a Telegram.");
  } catch (error) {
    console.error("Error en Weekly Epic Games Report:", error);
    try {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const runUrl = getGitHubRunUrl();
      const runUrlLine = runUrl ? `\n🔗 ${escapeMarkdown(runUrl)}` : "";
      await sendMessageTelegram({
        token: TELEGRAM_BOT_TOKEN,
        chatId: TELEGRAM_CHAT_ID,
        text: `⚠️ *Error en Weekly Epic Games Report:*\n\`\`\`\n${errorMsg.slice(0, 3000)}\n\`\`\`${runUrlLine}`,
      });
    } catch (telegramError) {
      console.error("Tampoco se pudo enviar el aviso de error a Telegram:", telegramError);
    }
    process.exit(1);
  }
};

main();

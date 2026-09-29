import { fetchRemotiveJobs } from "./services/remotive.js";
import { fetchGetOnBoardJobs } from "./services/getOnBoard.js";
import { fetchRemoteOkJobs } from "./services/remoteOk.js";
import { evaluateJobsWithGemini, type JobMatch } from "./services/gemini.js";
import { getDolarPrice } from "./services/dolar.js";
import { sendMessageTelegram } from "../utils/sendMessage.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !GEMINI_API_KEY) {
  console.error("Faltan variables de entorno necesarias para ejecutar daily-jobs-report (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY)");
  process.exit(1);
}

const formatSalary = (job: JobMatch, dolarRate: number): string => {
  if (job.estimatedHourlyUsd && job.estimatedHourlyUsd > 0) {
    const hourlyArs = Math.round(job.estimatedHourlyUsd * dolarRate);
    return `~$${job.estimatedHourlyUsd} USD/h (*~$${hourlyArs.toLocaleString("es-AR")} ARS/h*)`;
  }
  return "A convenir / No especificado";
};

const formatJobItem = (job: JobMatch, dolarRate: number): string => {
  return `
💼 *${job.title}* - *${job.company}*
🌐 *Portal:* ${job.source}
📍 *Ubicación:* ${job.location}
⭐ *Score:* ${job.score}/10
💵 *Pago estimado:* ${formatSalary(job, dolarRate)}
💡 *Match:* ${job.reason}
🔗 ${job.url}
`;
};

const main = async () => {
  try {
    console.log("Iniciando búsqueda multi-fuente de empleos (Get on Board, RemoteOK, Remotive)...");

    const [getOnBrdRes, remoteOkRes, remotiveRes, dolarRate] = await Promise.all([
      fetchGetOnBoardJobs().catch((err) => {
        console.warn("Aviso: Get on Board no respondió:", err);
        return [];
      }),
      fetchRemoteOkJobs().catch((err) => {
        console.warn("Aviso: RemoteOK no respondió:", err);
        return [];
      }),
      fetchRemotiveJobs().catch((err) => {
        console.warn("Aviso: Remotive no respondió:", err);
        return [];
      }),
      getDolarPrice(),
    ]);

    console.log(`Cotización Dólar referencia: $${dolarRate} ARS`);
    console.log(`Ofertas preliminares: Get on Board (${getOnBrdRes.length}), RemoteOK (${remoteOkRes.length}), Remotive (${remotiveRes.length})`);

    const allCandidateJobs = [...getOnBrdRes, ...remoteOkRes, ...remotiveRes];
    console.log(`Total consolidado de ofertas preliminares: ${allCandidateJobs.length}`);

    if (allCandidateJobs.length === 0) {
      console.log("No se encontraron ofertas preliminares en ninguna fuente para evaluar.");
      return;
    }

    console.log("Evaluando ofertas con Gemini AI según perfil, seniority e ingresos...");
    const matchedJobs = await evaluateJobsWithGemini(allCandidateJobs, GEMINI_API_KEY);

    console.log(`Gemini seleccionó ${matchedJobs.length} ofertas afines.`);

    if (matchedJobs.length === 0) {
      console.log("Ninguna oferta alcanzó el umbral de afinidad requerido (score >= 7). No se envía mensaje.");
      return;
    }

    // Ordenamiento con doble prioridad:
    // 1° Prioridad: Score de afinidad de Gemini (de mayor a menor)
    // 2° Prioridad (Desempate): Mayor pago estimado por hora
    matchedJobs.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const salaryA = a.estimatedHourlyUsd || 0;
      const salaryB = b.estimatedHourlyUsd || 0;
      return salaryB - salaryA;
    });

    const SEPARADOR = "\n━━━━━━━━━━━━━━━━\n";
    let messageText = `🎯 *OFERTAS DE EMPLEO DESTACADAS*\n_Filtro inteligente para Alejandro (Dólar ref: $${dolarRate})_\n`;

    matchedJobs.slice(0, 3).forEach((job) => {
      messageText += `${SEPARADOR}${formatJobItem(job, dolarRate)}`;
    });

    await sendMessageTelegram({
      token: TELEGRAM_BOT_TOKEN,
      chatId: TELEGRAM_CHAT_ID,
      text: messageText,
    });
    console.log("Mensaje con ofertas enviado exitosamente a Telegram.");
  } catch (error) {
    console.error("Error en Daily Jobs Report:", error);
    try {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await sendMessageTelegram({
        token: TELEGRAM_BOT_TOKEN,
        chatId: TELEGRAM_CHAT_ID,
        text: `⚠️ *Error en Daily Jobs Report:*\n\`\`\`\n${errorMsg.slice(0, 3000)}\n\`\`\``,
      });
    } catch (telegramError) {
      console.error("Tampoco se pudo enviar el aviso de error a Telegram:", telegramError);
    }
    process.exit(1);
  }
};

main();

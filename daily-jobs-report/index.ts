import { evaluateJobsWithGemini, type JobMatch } from "./services/gemini.js";
import { getProfileFromArgs } from "./profiles/index.js";
import type { PayFormat } from "./types.js";
import { sendMessageTelegram } from "../utils/sendMessage.js";

const profile = getProfileFromArgs();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Los avisos de error siempre van al chat principal: quien mantiene el proyecto es quien puede resolverlos
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const REPORT_CHAT_ID = process.env[profile.telegramChatIdEnvVar];
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !REPORT_CHAT_ID || !GEMINI_API_KEY) {
  console.error(`Faltan variables de entorno necesarias para ejecutar daily-jobs-report (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ${profile.telegramChatIdEnvVar}, GEMINI_API_KEY)`);
  process.exit(1);
}

const formatSalary = (job: JobMatch, payFormat: PayFormat): string => {
  if (job.estimatedPay && job.estimatedPay > 0) {
    return payFormat.formatPay(job.estimatedPay);
  }
  return "A convenir / No especificado";
};

// Los textos vienen de los avisos y de Gemini: un `*` o `_` suelto hace que Telegram rechace el mensaje completo
const escapeMarkdown = (text: string): string => text.replace(/([_*`[])/g, "\\$1");

const formatJobItem = (job: JobMatch, payFormat: PayFormat): string => {
  const scoreLine = profile.showScore ? `⭐ *Score:* ${job.score}/10\n` : "";

  return `
💼 *${escapeMarkdown(job.title)}* - *${escapeMarkdown(job.company)}*
🌐 *Portal:* ${job.source}
📍 *Ubicación:* ${escapeMarkdown(job.location)}
${scoreLine}💵 *Pago estimado:* ${formatSalary(job, payFormat)}
💡 *Por qué te conviene:* ${escapeMarkdown(job.reason)}
🔗 ${job.url}
`;
};

const main = async () => {
  try {
    const sourceNames = profile.sources.map((source) => source.name);
    console.log(`Iniciando búsqueda multi-fuente de empleos para ${profile.firstName} (${sourceNames.join(", ")})...`);

    const [settledSources, payFormat] = await Promise.all([
      Promise.allSettled(profile.sources.map((source) => source.fetchJobs())),
      profile.loadPayFormat(),
    ]);

    if (settledSources.every((result) => result.status === "rejected")) {
      throw new Error(`Ninguna fuente respondió (${sourceNames.join(", ")}): ${settledSources.map((result) => String(result.status === "rejected" && result.reason)).join(" | ")}`);
    }

    const jobsBySource = settledSources.map((result, index) => {
      if (result.status === "rejected") {
        console.warn(`Aviso: ${profile.sources[index]?.name} no respondió:`, result.reason);
        return [];
      }
      return result.value;
    });

    console.log(`Ofertas preliminares: ${profile.sources.map((source, index) => `${source.name} (${jobsBySource[index]?.length ?? 0})`).join(", ")}`);

    const allCandidateJobs = jobsBySource.flat();
    console.log(`Total consolidado de ofertas preliminares: ${allCandidateJobs.length}`);

    if (allCandidateJobs.length === 0) {
      console.log("No se encontraron ofertas preliminares en ninguna fuente para evaluar.");
      return;
    }

    console.log("Evaluando ofertas con Gemini AI según perfil e ingresos...");
    const matchedJobs = await evaluateJobsWithGemini(allCandidateJobs, profile.buildEvaluationCriteria(), GEMINI_API_KEY);

    console.log(`Gemini seleccionó ${matchedJobs.length} ofertas afines.`);

    if (matchedJobs.length === 0) {
      console.log("Ninguna oferta alcanzó el umbral de afinidad requerido (score >= 7). No se envía mensaje.");
      return;
    }

    // Ordenamiento con doble prioridad:
    // 1° Prioridad: Score de afinidad de Gemini (de mayor a menor)
    // 2° Prioridad (Desempate): Mayor pago estimado (en la unidad que define cada perfil)
    matchedJobs.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const salaryA = a.estimatedPay || 0;
      const salaryB = b.estimatedPay || 0;
      return salaryB - salaryA;
    });

    const SEPARADOR = "\n━━━━━━━━━━━━━━━━\n";
    const headerNote = payFormat.headerNote ? ` (${payFormat.headerNote})` : "";
    let messageText = `🎯 *OFERTAS DE EMPLEO DESTACADAS*\n_Filtro inteligente para ${profile.firstName}${headerNote}_\n`;

    matchedJobs.slice(0, profile.maxJobsInReport).forEach((job) => {
      messageText += `${SEPARADOR}${formatJobItem(job, payFormat)}`;
    });

    await sendMessageTelegram({
      token: TELEGRAM_BOT_TOKEN,
      chatId: REPORT_CHAT_ID,
      text: messageText,
    });
    console.log("Mensaje con ofertas enviado exitosamente a Telegram.");
  } catch (error) {
    console.error(`Error en Daily Jobs Report (${profile.firstName}):`, error);
    try {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await sendMessageTelegram({
        token: TELEGRAM_BOT_TOKEN,
        chatId: TELEGRAM_CHAT_ID,
        text: `⚠️ *Error en Daily Jobs Report (${profile.firstName}):*\n\`\`\`\n${errorMsg.slice(0, 3000)}\n\`\`\``,
      });
    } catch (telegramError) {
      console.error("Tampoco se pudo enviar el aviso de error a Telegram:", telegramError);
    }
    process.exit(1);
  }
};

main();

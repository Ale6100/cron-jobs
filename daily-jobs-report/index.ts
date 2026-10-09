import { evaluateJobsWithGemini, MAX_JOBS_TO_EVALUATE, type JobMatch } from "./services/gemini.js";
import { splitIntoMessages } from "./message.js";
import { getProfileFromArgs } from "./profiles/index.js";
import { computeSeenJobIds, loadSeenJobIds, saveSeenJobIds } from "./seenJobs.js";
import type { PayFormat } from "./types.js";
import { sendMessageTelegram } from "../utils/sendMessage.js";

const profile = getProfileFromArgs();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
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

const escapeMarkdown = (text: string): string => text.replace(/([_*`[])/g, "\\$1");

const formatJobItem = (job: JobMatch, payFormat: PayFormat): string => {
  const scoreLine = profile.showScore ? `⭐ *Score:* ${job.score}/10\n` : "";
  const closingDateLine = job.closingDate ? `📅 *Cierre:* ${escapeMarkdown(job.closingDate)}\n` : "";

  return `
💼 *${escapeMarkdown(job.title)}* - *${escapeMarkdown(job.company)}*
🌐 *Portal:* ${job.source}
📍 *Ubicación:* ${escapeMarkdown(job.location)}
${scoreLine}💵 *Pago estimado:* ${formatSalary(job, payFormat)}
${closingDateLine}💡 *Por qué te conviene:* ${escapeMarkdown(job.reason)}
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

    const { seenJobsStateFile } = profile;
    const seenJobIds = seenJobsStateFile ? await loadSeenJobIds(seenJobsStateFile) : new Set<string>();
    const jobsToEvaluate = allCandidateJobs.filter((job) => !seenJobIds.has(String(job.id))).slice(0, MAX_JOBS_TO_EVALUATE);

    const rememberEvaluatedJobs = async () => {
      if (!seenJobsStateFile) return;
      const evaluatedIds = new Set(jobsToEvaluate.map((job) => String(job.id)));
      const allSourcesResponded = settledSources.every((result) => result.status === "fulfilled");
      await saveSeenJobIds(seenJobsStateFile, computeSeenJobIds(allCandidateJobs, seenJobIds, evaluatedIds, allSourcesResponded));
    };

    if (seenJobsStateFile) {
      console.log(`Ofertas nuevas (no evaluadas en corridas anteriores): ${jobsToEvaluate.length}`);
    }

    if (jobsToEvaluate.length === 0) {
      console.log("No hay ofertas para evaluar.");
      await rememberEvaluatedJobs();
      return;
    }

    console.log("Evaluando ofertas con Gemini AI según perfil e ingresos...");
    const matchedJobs = await evaluateJobsWithGemini(jobsToEvaluate, profile.buildGeminiPromptHeader(payFormat), GEMINI_API_KEY);

    console.log(`Gemini seleccionó ${matchedJobs.length} ofertas afines.`);

    if (matchedJobs.length === 0) {
      console.log("Ninguna oferta alcanzó el umbral de afinidad requerido (score >= 7). No se envía mensaje.");
      await rememberEvaluatedJobs();
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
    const header = `🎯 *OFERTAS DE EMPLEO DESTACADAS*\n_Filtro inteligente para ${profile.firstName}${headerNote}_\n`;
    const jobItems = matchedJobs.slice(0, profile.maxJobsInReport).map((job) => `${SEPARADOR}${formatJobItem(job, payFormat)}`);

    for (const text of splitIntoMessages(header, jobItems)) {
      await sendMessageTelegram({
        token: TELEGRAM_BOT_TOKEN,
        chatId: REPORT_CHAT_ID,
        text,
      });
    }
    console.log("Mensaje con ofertas enviado exitosamente a Telegram.");
    await rememberEvaluatedJobs();
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

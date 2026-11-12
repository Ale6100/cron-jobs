import { escapeMarkdown, getGitHubRunUrl } from "../utils/util.js";
import type { JobMatch } from "./services/gemini.js";
import type { PayFormat } from "./types.js";

export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

export const formatSalary = (job: JobMatch, payFormat: PayFormat): string => {
  if (job.estimatedPay && job.estimatedPay > 0) {
    return payFormat.formatPay(job.estimatedPay);
  }
  return "A convenir / No especificado";
};

export const formatJobItem = (job: JobMatch, payFormat: PayFormat, showScore = false): string => {
  const scoreLine = showScore ? `⭐ *Score:* ${job.score}/10\n` : "";
  const closingDateLine = job.closingDate ? `📅 *Cierre:* ${escapeMarkdown(job.closingDate)}\n` : "";

  return `
💼 *${escapeMarkdown(job.title)}* - *${escapeMarkdown(job.company)}*
🌐 *Portal:* ${escapeMarkdown(job.source)}
📍 *Ubicación:* ${escapeMarkdown(job.location)}
${scoreLine}💵 *Pago estimado:* ${formatSalary(job, payFormat)}
${closingDateLine}💡 *Por qué te conviene:* ${escapeMarkdown(job.reason)}
🔗 ${escapeMarkdown(job.url)}
`;
};

export const splitIntoMessages = (header: string, items: string[], maxLength = TELEGRAM_MAX_MESSAGE_LENGTH): string[] => {
  const messages: string[] = [];
  let currentMessage = header;

  for (const item of items) {
    if (currentMessage !== header && currentMessage.length + item.length > maxLength) {
      messages.push(currentMessage);
      currentMessage = "";
    }
    currentMessage += item;
  }

  messages.push(currentMessage);
  return messages;
};

export const formatJobsReportErrorMessage = (firstName: string, error: unknown): string => {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const runUrl = getGitHubRunUrl();
  const runUrlLine = runUrl ? `\n🔗 ${escapeMarkdown(runUrl)}` : "";
  return `⚠️ *Error en Daily Jobs Report (${firstName}):*\n\`\`\`\n${errorMsg.slice(0, 3000)}\n\`\`\`${runUrlLine}`;
};

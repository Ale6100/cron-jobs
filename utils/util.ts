export const formatPrice = (value: number, decimals: boolean = true) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(value ?? 0);
};

/** Escapa caracteres especiales de Markdown legacy de Telegram (*, _, `, [, ]). */
export const escapeMarkdown = (text: string): string => text.replace(/([_*`[\]])/g, "\\$1");

/** Obtiene la URL de la corrida de GitHub Actions actual si se ejecuta en CI, o null si es local. */
export const getGitHubRunUrl = (): string | null => {
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!repository || !runId) {
    return null;
  }
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  return `${serverUrl}/${repository}/actions/runs/${runId}`;
};

export type JobSource = "Get on Board" | "RemoteOK" | "Remotive" | "Bumeran" | "Computrabajo";

export interface CleanJob {
  id: string | number;
  title: string;
  company: string;
  location: string;
  url: string;
  source: JobSource;
  salary?: string | undefined;
  publicationDate?: string | undefined;
  tags: string[];
  snippet: string;
}

export interface JobSourceFetcher {
  name: JobSource;
  fetchJobs: () => Promise<CleanJob[]>;
}

export interface PayFormat {
  headerNote?: string;
  formatPay: (estimatedPay: number) => string;
}

export interface JobsReportProfile {
  firstName: string;
  telegramChatIdEnvVar: string;
  showScore: boolean;
  maxJobsInReport: number;
  sources: JobSourceFetcher[];
  /** Encabezado del prompt de Gemini: perfil del candidato y criterios, incluido cómo calcular `estimatedPay`. */
  buildEvaluationCriteria: () => string;
  loadPayFormat: () => Promise<PayFormat>;
}

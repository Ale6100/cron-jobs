export type JobSource = "Get on Board" | "RemoteOK" | "Remotive" | "Bumeran" | "Computrabajo" | "Exactas UBA";

export interface CleanJob {
  id: string | number;
  title: string;
  company: string;
  location: string;
  url: string;
  source: JobSource;
  salary?: string | undefined;
  publicationDate?: string | undefined;
  closingDate?: string | undefined;
  tags: string[];
  snippet: string;
}

export interface JobSourceFetcher {
  name: JobSource;
  fetchJobs: () => Promise<CleanJob[]>;
}

export interface PayFormat {
  headerNote?: string;
  usdToArsRate?: number;
  formatPay: (estimatedPay: number) => string;
}

export interface JobsReportProfile {
  firstName: string;
  telegramChatIdEnvVar: string;
  showScore: boolean;
  maxJobsInReport: number;
  seenJobsStateFile?: string;
  sources: JobSourceFetcher[];
  buildGeminiPromptHeader: (payFormat: PayFormat) => string;
  loadPayFormat: () => Promise<PayFormat>;
}

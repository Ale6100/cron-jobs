export type JobSource = "Get on Board" | "RemoteOK" | "Remotive";

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

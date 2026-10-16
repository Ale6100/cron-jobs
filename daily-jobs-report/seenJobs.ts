import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { CleanJob } from "./types.js";

const STATE_DIR = new URL("./state/", import.meta.url);

export const loadSeenJobIds = async (fileName: string, stateDir = STATE_DIR): Promise<Set<string>> => {
  try {
    const content = await readFile(new URL(fileName, stateDir), "utf-8");
    const ids: unknown = JSON.parse(content);
    if (!Array.isArray(ids)) {
      throw new Error(`El estado de ofertas ya evaluadas (${fileName}) no es una lista`);
    }
    return new Set(ids.map(String));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
};

export const saveSeenJobIds = async (fileName: string, ids: string[], stateDir = STATE_DIR): Promise<void> => {
  await mkdir(stateDir, { recursive: true });
  await writeFile(new URL(fileName, stateDir), `${JSON.stringify([...ids].sort(), null, 2)}\n`);
};

export const computeSeenJobIds = (
  listedJobs: CleanJob[],
  previouslySeenIds: Set<string>,
  evaluatedIds: Set<string>,
  allSourcesResponded: boolean
): string[] => {
  if (!allSourcesResponded) {
    return [...new Set([...previouslySeenIds, ...evaluatedIds])];
  }
  return listedJobs
    .map((job) => String(job.id))
    .filter((id) => previouslySeenIds.has(id) || evaluatedIds.has(id));
};

const GENERIC_COMPANY_NAMES = new Set([
  "",
  "empresa",
  "empresa confidencial",
  "empresa no especificada",
  "empresa en get on board",
  "empresa en remoteok",
  "empresa en computrabajo",
  "empresa en freehire",
  "empresa en linkedin",
]);

const normalizeKeyPart = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

export const consolidateCandidateJobs = (jobsBySource: CleanJob[][]): CleanJob[] => {
  const seenIds = new Set<string>();
  const seenCompanyTitles = new Set<string>();
  const consolidated: CleanJob[] = [];
  const longestSource = Math.max(0, ...jobsBySource.map((jobs) => jobs.length));

  for (let index = 0; index < longestSource; index++) {
    for (const sourceJobs of jobsBySource) {
      const job = sourceJobs[index];
      if (!job) {
        continue;
      }

      const idKey = String(job.id);
      const companyNorm = normalizeKeyPart(job.company);
      const titleNorm = normalizeKeyPart(job.title);
      const hasSpecificCompany = !GENERIC_COMPANY_NAMES.has(companyNorm);
      const companyTitleKey = hasSpecificCompany && titleNorm ? `${companyNorm}::${titleNorm}` : "";

      if (seenIds.has(idKey) || (companyTitleKey && seenCompanyTitles.has(companyTitleKey))) {
        continue;
      }

      seenIds.add(idKey);
      if (companyTitleKey) {
        seenCompanyTitles.add(companyTitleKey);
      }
      consolidated.push(job);
    }
  }

  return consolidated;
};

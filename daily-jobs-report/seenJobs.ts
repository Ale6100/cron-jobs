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

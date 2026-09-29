import type { CleanJob } from "../types.js";

interface RemoteOkJobItem {
  id?: string;
  position?: string;
  company?: string;
  location?: string;
  tags?: string[];
  url?: string;
  description?: string;
  date?: string;
  salary_min?: number;
  salary_max?: number;
}

const stripHtml = (html: string): string => {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
};

const TECH_KEYWORDS = [
  "frontend",
  "front-end",
  "front end",
  "react",
  "next.js",
  "nextjs",
  "typescript",
  "fullstack",
  "full-stack",
  "full stack",
  "javascript",
  "nestjs",
  "nest.js",
  "node",
  "python",
  "llm",
  "web dev",
  "web developer",
];

const EXCLUDED_LOCATIONS = [
  "usa only",
  "us only",
  "uk only",
  "canada only",
  "europe only",
  "germany only",
  "australia only",
];

const isLocationCompatible = (location?: string): boolean => {
  if (!location || location.trim() === "") {
    return true; // En RemoteOK, location vacía significa Worldwide
  }

  const loc = location.toLowerCase();
  if (
    loc.includes("worldwide") ||
    loc.includes("anywhere") ||
    loc.includes("latam") ||
    loc.includes("americas") ||
    loc.includes("argentina")
  ) {
    return true;
  }

  const isExclusivelyRestricted = EXCLUDED_LOCATIONS.some((excluded) =>
    loc === excluded || loc.startsWith(excluded)
  );

  return !isExclusivelyRestricted;
};

export const fetchRemoteOkJobs = async (): Promise<CleanJob[]> => {
  const url = "https://remoteok.com/api";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CronJobsBot/1.0; +https://github.com/Ale6100/cron-jobs)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`RemoteOK API respondió ${res.status}: ${res.statusText}`);
  }

  const rawData = (await res.json()) as RemoteOkJobItem[];

  // El primer elemento de RemoteOK suele ser un aviso legal/metadata sin campo `id`
  const rawJobs = rawData.filter((item) => Boolean(item.id && item.position));

  const candidateJobs: CleanJob[] = [];

  for (const job of rawJobs) {
    if (!isLocationCompatible(job.location)) {
      continue;
    }

    const titleLower = (job.position || "").toLowerCase();
    const tagsLower = (job.tags || []).map((t) => t.toLowerCase());

    const hasTechMatch = TECH_KEYWORDS.some(
      (kw) => titleLower.includes(kw) || tagsLower.includes(kw)
    );

    if (!hasTechMatch) {
      continue;
    }

    let salaryLabel = "No especificado";
    if (job.salary_min && job.salary_max) {
      salaryLabel = `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()} USD`;
    }

    candidateJobs.push({
      id: `remoteok-${job.id}`,
      title: job.position || "Developer",
      company: job.company || "Empresa en RemoteOK",
      location: job.location || "Remoto (Worldwide)",
      url: job.url || "https://remoteok.com",
      source: "RemoteOK",
      salary: salaryLabel,
      publicationDate: job.date,
      tags: job.tags || [],
      snippet: stripHtml(job.description || "").slice(0, 700),
    });
  }

  return candidateJobs;
};

export interface RemotiveJobItem {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

import type { CleanJob } from "../types.js";

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

export const isLocationCompatible = (location: string): boolean => {
  const loc = location.toLowerCase();
  if (
    loc.includes("worldwide") ||
    loc.includes("anywhere") ||
    loc.includes("latam") ||
    loc.includes("latin america") ||
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

export const fetchRemotiveJobs = async (): Promise<CleanJob[]> => {
  const url = "https://remotive.com/api/remote-jobs?category=software-dev&limit=60";
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Remotive API respondió ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as { jobs?: RemotiveJobItem[] };
  const rawJobs = data.jobs ?? [];

  const candidateJobs: CleanJob[] = [];

  for (const job of rawJobs) {
    if (!isLocationCompatible(job.candidate_required_location)) {
      continue;
    }

    const titleLower = job.title.toLowerCase();
    const tagsLower = (job.tags || []).map((t) => t.toLowerCase());
    const hasTechMatch = TECH_KEYWORDS.some(
      (keyword) => titleLower.includes(keyword) || tagsLower.includes(keyword)
    );

    if (!hasTechMatch) {
      continue;
    }

    const cleanDescription = stripHtml(job.description);

    candidateJobs.push({
      id: job.id,
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || "Remoto",
      url: job.url,
      source: "Remotive",
      salary: job.salary || "No especificado",
      publicationDate: job.publication_date,
      tags: job.tags || [],
      snippet: cleanDescription.slice(0, 700),
    });
  }

  return candidateJobs;
};

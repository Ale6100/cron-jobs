import type { CleanJob } from "../types.js";

export interface FreehireJobItem {
  public_slug: string;
  url?: string | undefined;
  title?: string | undefined;
  company?: string | undefined;
  location?: string | undefined;
  description?: string | undefined;
  skills?: string[] | undefined;
  work_mode?: string | undefined;
  regions?: string[] | undefined;
  countries?: string[] | undefined;
  posted_at?: string | null | undefined;
  enrichment?:
    | {
        seniority?: string | undefined;
        salary_min?: number | undefined;
        salary_max?: number | undefined;
        salary_currency?: string | undefined;
        salary_period?: string | undefined;
      }
    | undefined;
}

const SEARCH_ENDPOINT = "https://freehire.me/api/v1/agent/jobs/search";

const SEARCH_QUERIES = [
  "countries=ar&category=frontend&category=fullstack&posted_within_days=14&limit=50&include_description=true&description_format=text",
  "regions=latam&regions=global&work_mode=remote&category=frontend&category=fullstack&posted_within_days=14&limit=50&include_description=true&description_format=text",
];

const EXCLUDED_SENIORITIES = new Set(["senior", "staff", "principal", "lead"]);

const EXCLUDED_LOCATIONS = [
  "usa only",
  "us only",
  "uk only",
  "canada only",
  "europe only",
  "germany only",
  "australia only",
];

const BUENOS_AIRES_LOCALITIES = ["buenos aires", "caba", "capital federal"];

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

const stripHtml = (text: string): string => {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
};

export const isFreehireLocationCompatible = (job: FreehireJobItem): boolean => {
  const locLower = (job.location || "").toLowerCase().trim();
  const countries = (job.countries || []).map((country) => country.toLowerCase());
  const isRemote = job.work_mode === "remote" || locLower.includes("remote") || locLower.includes("remoto");

  if (EXCLUDED_LOCATIONS.some((excluded) => locLower === excluded || locLower.startsWith(excluded))) {
    return false;
  }

  if (isRemote) {
    return countries.length === 0 || countries.includes("ar");
  }

  if (!countries.includes("ar")) {
    return false;
  }

  return (
    locLower === "" ||
    locLower === "argentina" ||
    BUENOS_AIRES_LOCALITIES.some((locality) => locLower.includes(locality))
  );
};

const formatSalary = (enrichment: FreehireJobItem["enrichment"]): string => {
  if (!enrichment || (enrichment.salary_min == null && enrichment.salary_max == null)) {
    return "No especificado";
  }
  const currency = enrichment.salary_currency || "USD";
  const period = enrichment.salary_period ? `/${enrichment.salary_period}` : "";
  if (enrichment.salary_min != null && enrichment.salary_max != null) {
    return `$${enrichment.salary_min} - $${enrichment.salary_max} ${currency}${period}`;
  }
  const amount = enrichment.salary_min ?? enrichment.salary_max ?? 0;
  return `$${amount} ${currency}${period}`;
};

const formatLocation = (job: FreehireJobItem): string => {
  const rawLocation = job.location?.trim();
  const isRemote = job.work_mode === "remote" || Boolean(rawLocation && /remote|remoto/i.test(rawLocation));
  if (isRemote) {
    return rawLocation ? `Remoto (${rawLocation})` : "Remoto (Global/LATAM)";
  }
  return rawLocation ? `Presencial/Híbrido (${rawLocation})` : "Presencial/Híbrido (Argentina)";
};

export const filterAndMapFreehireJobs = (rawJobs: FreehireJobItem[]): CleanJob[] => {
  const seenSlugs = new Set<string>();
  const candidateJobs: CleanJob[] = [];

  for (const job of rawJobs) {
    if (!job.public_slug || seenSlugs.has(job.public_slug)) {
      continue;
    }

    const seniority = job.enrichment?.seniority?.toLowerCase() ?? "";
    if (EXCLUDED_SENIORITIES.has(seniority)) {
      continue;
    }

    if (!isFreehireLocationCompatible(job)) {
      continue;
    }

    const titleClean = stripHtml(job.title || "");
    const titleLower = titleClean.toLowerCase();
    const skillsLower = (job.skills || []).map((skill) => skill.toLowerCase());
    const descClean = stripHtml(job.description || "");
    const descLower = descClean.toLowerCase();

    const hasTechMatch = TECH_KEYWORDS.some(
      (kw) => titleLower.includes(kw) || skillsLower.includes(kw) || descLower.includes(kw)
    );

    if (!hasTechMatch) {
      continue;
    }

    seenSlugs.add(job.public_slug);

    candidateJobs.push({
      id: `freehire-${job.public_slug}`,
      title: titleClean || "Developer",
      company: job.company || "Empresa en FreeHire",
      location: formatLocation(job),
      url: job.url || `https://freehire.me/jobs/${job.public_slug}`,
      source: "FreeHire",
      salary: formatSalary(job.enrichment),
      publicationDate: job.posted_at ?? undefined,
      tags: job.skills || [],
      snippet: descClean.slice(0, 700),
    });
  }

  return candidateJobs;
};

const fetchQuery = async (query: string): Promise<FreehireJobItem[]> => {
  const res = await fetch(`${SEARCH_ENDPOINT}?${query}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CronJobsBot/1.0; +https://github.com/Ale6100/cron-jobs)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`FreeHire API respondió ${res.status}: ${res.statusText}`);
  }

  const body = (await res.json()) as { data?: FreehireJobItem[] };
  if (!Array.isArray(body.data)) {
    throw new Error("FreeHire respondió sin el listado de ofertas");
  }

  return body.data;
};

export const fetchFreehireJobs = async (): Promise<CleanJob[]> => {
  const settled = await Promise.allSettled(SEARCH_QUERIES.map(fetchQuery));

  const results = settled.flatMap((result, index) => {
    if (result.status === "rejected") {
      console.warn(`Aviso: la consulta ${index + 1} en FreeHire falló:`, result.reason);
      return [];
    }
    return result.value;
  });

  if (settled.every((result) => result.status === "rejected")) {
    throw new Error("Fallaron todas las búsquedas en FreeHire");
  }

  return filterAndMapFreehireJobs(results);
};

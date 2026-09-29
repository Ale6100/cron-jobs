import type { CleanJob } from "../types.js";

interface GetOnBoardJobItem {
  id: string;
  type: string;
  attributes: {
    title: string;
    description: string;
    projects?: string;
    functions?: string;
    benefits?: string;
    remote: boolean;
    remote_modality: string;
    countries?: string[];
    min_salary?: number | null;
    max_salary?: number | null;
    published_at?: number;
  };
  links: {
    public_url: string;
  };
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
  "web developer",
];

// Intenta extraer el nombre de la empresa a partir del slug de Get on Board (ej: "software-engineer-semi-senior-buho-remote" -> "Buho")
const extractCompanyFromSlug = (slug: string): string => {
  const parts = slug.split("-");
  if (parts.length >= 3) {
    const candidate = parts[parts.length - 2];
    if (candidate && candidate.length > 2 && !["remote", "latam", "hybrid", "onsite"].includes(candidate)) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }
  return "Empresa en Get on Board";
};

export const fetchGetOnBoardJobs = async (): Promise<CleanJob[]> => {
  const url = "https://www.getonbrd.com/api/v0/categories/programming/jobs?per_page=100";
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Get on Board API respondió ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: GetOnBoardJobItem[] };
  const rawJobs = json.data ?? [];

  const candidateJobs: CleanJob[] = [];

  for (const job of rawJobs) {
    const attrs = job.attributes;
    const countries = (attrs.countries || []).map((c) => c.toLowerCase());

    const isRemote = attrs.remote || countries.includes("remote") || countries.includes("remoto");
    const isArgentina = countries.includes("argentina") || countries.includes("caba") || countries.includes("buenos aires");

    // Aceptamos si es remoto o si está en Argentina
    if (!isRemote && !isArgentina) {
      continue;
    }

    const titleLower = attrs.title.toLowerCase();
    const combinedDesc = `${attrs.description} ${attrs.projects || ""} ${attrs.functions || ""}`;
    const descLower = combinedDesc.toLowerCase();

    const hasTechMatch = TECH_KEYWORDS.some(
      (kw) => titleLower.includes(kw) || descLower.includes(kw)
    );

    if (!hasTechMatch) {
      continue;
    }

    let locationLabel = "Remoto";
    if (isRemote) {
      locationLabel = attrs.remote_modality === "fully_remote"
        ? "Remoto (Global)"
        : `Remoto (${attrs.countries?.join(", ") || "LATAM"})`;
    } else if (isArgentina) {
      locationLabel = `Presencial/Híbrido (${attrs.countries?.join(", ") || "Argentina"})`;
    }

    let salaryLabel = "No especificado";
    if (attrs.min_salary && attrs.max_salary) {
      salaryLabel = `$${attrs.min_salary} - $${attrs.max_salary} USD`;
    } else if (attrs.min_salary) {
      salaryLabel = `Desde $${attrs.min_salary} USD`;
    }

    candidateJobs.push({
      id: job.id,
      title: attrs.title,
      company: extractCompanyFromSlug(job.id),
      location: locationLabel,
      url: job.links.public_url,
      source: "Get on Board",
      salary: salaryLabel,
      publicationDate: attrs.published_at ? new Date(attrs.published_at * 1000).toISOString() : undefined,
      tags: [],
      snippet: stripHtml(combinedDesc).slice(0, 700),
    });
  }

  return candidateJobs;
};

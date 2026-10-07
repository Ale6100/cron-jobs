import type { CleanJob } from "../types.js";

interface JobPostingJsonLd {
  "@type"?: string;
  title?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string;
  url?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string } };
  baseSalary?: { currency?: string; value?: { value?: number; unitText?: string } };
}

const BASE_URL = "https://ar.computrabajo.com";

const SEARCH_SLUGS = [
  "cajera",
  "vendedora",
  "repositor",
  "atencion-al-cliente",
  "ayudante-de-cocina",
  "cuidado-de-adultos-mayores",
];

const LOCATION_SLUG = "capital-federal";

const MAX_JOBS = 15;

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; CronJobsBot/1.0; +https://github.com/Ale6100/cron-jobs)",
};

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

const fetchHtml = async (url: string): Promise<string> => {
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`Computrabajo respondió ${res.status}: ${res.statusText} (${url})`);
  }
  return res.text();
};

export const extractOfferPaths = (listingHtml: string): string[] => {
  const paths = [...listingHtml.matchAll(/href="(\/ofertas-de-trabajo\/[^"#?]+)/g)].map((match) => match[1] ?? "");
  return [...new Set(paths)].filter(Boolean);
};

export const pickPathsAcrossSearches = (pathsBySearch: string[][]): string[] => {
  const picked = new Set<string>();
  const longestResult = Math.max(0, ...pathsBySearch.map((paths) => paths.length));

  for (let index = 0; index < longestResult && picked.size < MAX_JOBS; index++) {
    for (const paths of pathsBySearch) {
      const path = paths[index];
      if (path && picked.size < MAX_JOBS) {
        picked.add(path);
      }
    }
  }

  return [...picked];
};

export const parseJobPosting = (detailHtml: string, url: string): CleanJob | null => {
  const jsonLdBlocks = [...detailHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  for (const block of jsonLdBlocks) {
    let parsed: { "@graph"?: JobPostingJsonLd[] } & JobPostingJsonLd;
    try {
      parsed = JSON.parse(block[1] ?? "");
    } catch {
      continue;
    }

    const posting = (parsed["@graph"] ?? [parsed]).find((item) => item["@type"] === "JobPosting");
    if (!posting?.title) {
      continue;
    }

    const address = posting.jobLocation?.address;
    const salaryAmount = posting.baseSalary?.value?.value;

    return {
      id: `computrabajo-${url.split("-").pop()}`,
      title: posting.title,
      company: posting.hiringOrganization?.name || "Empresa en Computrabajo",
      location: [address?.addressRegion, address?.addressLocality].filter(Boolean).join(", ") || "Capital Federal",
      url,
      source: "Computrabajo",
      salary: salaryAmount && salaryAmount > 0
        ? `$${salaryAmount.toLocaleString("es-AR")} ${posting.baseSalary?.currency ?? "ARS"} (${posting.baseSalary?.value?.unitText ?? "MONTH"})`
        : "No especificado",
      publicationDate: posting.datePosted,
      tags: posting.employmentType ? [posting.employmentType] : [],
      snippet: stripHtml(posting.description || "").slice(0, 700),
    };
  }

  return null;
};

export const fetchComputrabajoJobs = async (): Promise<CleanJob[]> => {
  const listingResults = await Promise.allSettled(
    SEARCH_SLUGS.map((slug) => fetchHtml(`${BASE_URL}/trabajo-de-${slug}-en-${LOCATION_SLUG}`))
  );

  const pathsBySearch = listingResults.flatMap((result, index) => {
    if (result.status === "rejected") {
      console.warn(`Aviso: la búsqueda "${SEARCH_SLUGS[index]}" en Computrabajo falló:`, result.reason);
      return [];
    }
    return [extractOfferPaths(result.value)];
  });

  if (pathsBySearch.length === 0) {
    throw new Error("Fallaron todas las búsquedas en Computrabajo");
  }

  const detailResults = await Promise.allSettled(
    pickPathsAcrossSearches(pathsBySearch).map(async (path) => {
      const url = `${BASE_URL}${path}`;
      return parseJobPosting(await fetchHtml(url), url);
    })
  );

  const jobs = detailResults.flatMap((result) => {
    if (result.status === "rejected") {
      console.warn("Aviso: no se pudo leer una oferta de Computrabajo:", result.reason);
      return [];
    }
    return result.value ? [result.value] : [];
  });

  if (detailResults.length > 0 && jobs.length === 0) {
    throw new Error("No se pudo interpretar ninguna oferta de Computrabajo: es probable que haya cambiado el formato de sus páginas");
  }

  return jobs;
};

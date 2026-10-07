import type { CleanJob } from "../types.js";

interface BumeranJobItem {
  id: number;
  titulo: string;
  detalle?: string;
  empresa?: string;
  confidencial?: boolean;
  fechaPublicacion?: string;
  tipoTrabajo?: string;
  localizacion?: string;
  modalidadTrabajo?: string;
}

const SEARCH_QUERIES = [
  "cajera",
  "vendedora",
  "repositora",
  "atención al cliente",
  "ayudante de cocina",
  "cuidado de adultos mayores",
];

const MAX_JOBS = 20;

const stripHtml = (html: string): string => {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
};

const isLocationCompatible = (job: BumeranJobItem): boolean => {
  return job.modalidadTrabajo === "Remoto" || Boolean(job.localizacion?.endsWith("Buenos Aires"));
};

const toCleanJob = (job: BumeranJobItem): CleanJob => ({
  id: `bumeran-${job.id}`,
  title: job.titulo,
  company: job.confidencial || !job.empresa ? "Empresa confidencial" : job.empresa,
  location: `${job.modalidadTrabajo || "Presencial"} (${job.localizacion || "Argentina"})`,
  url: `https://www.bumeran.com.ar/empleos/${job.id}.html`,
  source: "Bumeran",
  salary: "No especificado",
  publicationDate: job.fechaPublicacion,
  tags: job.tipoTrabajo ? [job.tipoTrabajo] : [],
  snippet: stripHtml(job.detalle || "").slice(0, 700),
});

const searchBumeran = async (query: string): Promise<BumeranJobItem[]> => {
  const res = await fetch("https://www.bumeran.com.ar/api/avisos/searchV2?pageSize=20&page=0&sort=RECIENTES", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CronJobsBot/1.0; +https://github.com/Ale6100/cron-jobs)",
      "Content-Type": "application/json",
      "x-site-id": "BMAR",
      Referer: "https://www.bumeran.com.ar/",
    },
    body: JSON.stringify({ filtros: [], query }),
  });

  if (!res.ok) {
    throw new Error(`Bumeran API respondió ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as { content?: BumeranJobItem[] };
  if (!Array.isArray(data.content)) {
    throw new Error("Bumeran respondió sin el listado de avisos: es probable que haya cambiado el formato de su API");
  }
  return data.content;
};

export const pickJobsAcrossQueries = (resultsByQuery: BumeranJobItem[][]): CleanJob[] => {
  const seenIds = new Set<number>();
  const picked: CleanJob[] = [];
  const longestResult = Math.max(0, ...resultsByQuery.map((results) => results.length));

  for (let index = 0; index < longestResult && picked.length < MAX_JOBS; index++) {
    for (const results of resultsByQuery) {
      const job = results[index];
      if (!job || seenIds.has(job.id) || !isLocationCompatible(job)) {
        continue;
      }
      seenIds.add(job.id);
      picked.push(toCleanJob(job));
      if (picked.length === MAX_JOBS) {
        break;
      }
    }
  }

  return picked;
};

export const fetchBumeranJobs = async (): Promise<CleanJob[]> => {
  const settledResults = await Promise.allSettled(SEARCH_QUERIES.map(searchBumeran));

  const resultsByQuery = settledResults.flatMap((result, index) => {
    if (result.status === "rejected") {
      console.warn(`Aviso: la búsqueda "${SEARCH_QUERIES[index]}" en Bumeran falló:`, result.reason);
      return [];
    }
    return [result.value];
  });

  if (resultsByQuery.length === 0) {
    throw new Error("Fallaron todas las búsquedas en Bumeran");
  }

  return pickJobsAcrossQueries(resultsByQuery);
};

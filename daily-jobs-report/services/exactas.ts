import type { CleanJob } from "../types.js";

export const EXACTAS_OFFERS_URL = "https://exactas.uba.ar/ofertas-de-trabajo-profesional/ofertas-activas-estudiantes/";

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; CronJobsBot/1.0; +https://github.com/Ale6100/cron-jobs)",
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  nbsp: " ",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
};

const decodeHtmlEntities = (text: string): string => {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
};

const stripHtml = (html: string): string => {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
};

const extractField = (contentHtml: string, label: string): string | undefined => {
  const match = contentHtml.match(new RegExp(`<strong>\\s*${label}:\\s*</strong>([\\s\\S]*?)</div>`, "i"));
  const value = match?.[1] ? stripHtml(match[1]) : "";
  return value || undefined;
};

const splitPositionAndCompany = (position: string): { title: string; company: string | undefined } => {
  const match = position.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!match?.[1] || !match[2]) {
    return { title: position, company: undefined };
  }
  const company = match[2].split(/\s+[–-]\s+área:/i)[0]?.trim();
  return { title: match[1].trim(), company: company || undefined };
};

const removeApplicationInstructions = (contentHtml: string): string => {
  const instructionsIndex = contentHtml.search(/CÓMO POSTULARSE/i);
  if (instructionsIndex === -1) return contentHtml;
  const boxStart = contentHtml.lastIndexOf("<div", instructionsIndex);
  return contentHtml.slice(0, boxStart === -1 ? instructionsIndex : boxStart);
};

export const parseClosingDate = (closingDate: string): Date | null => {
  const match = closingDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  return new Date(year, Number(match[2]) - 1, Number(match[1]));
};

const getArgentinaDate = (instant: Date): Date => {
  const [year, month, day] = instant.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

export const isStillOpen = (job: CleanJob, now: Date): boolean => {
  const closingDate = job.closingDate ? parseClosingDate(job.closingDate) : null;
  if (!closingDate) return true;
  return closingDate >= getArgentinaDate(now);
};

export const parseExactasOffers = (pageHtml: string): CleanJob[] => {
  const offerBlocks = pageHtml.split(/<div class="su-spoiler\s/).slice(1);

  return offerBlocks.flatMap((block) => {
    const titleHtml = block.match(/class="su-spoiler-title"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const heading = stripHtml(titleHtml);
    const offerNumber = heading.match(/Oferta\s*#\s*([\d/]+)/i)?.[1];
    if (!offerNumber) {
      return [];
    }

    const contentHtml = removeApplicationInstructions(block.slice(block.indexOf("su-spoiler-content")));
    const position = heading.split(/Nombre del puesto:/i)[1]?.trim() || extractField(contentHtml, "Nombre del puesto") || heading;
    const { title, company } = splitPositionAndCompany(position);
    const tags = [extractField(contentHtml, "Tipo de vínculo"), extractField(contentHtml, "Horario estipulado")].filter((tag): tag is string => Boolean(tag));

    return [{
      id: `exactas-${offerNumber}`,
      title: `#${offerNumber} · ${title}`,
      company: company ?? "Empresa no especificada",
      location: extractField(contentHtml, "Zona de trabajo") ?? "No especificada",
      url: EXACTAS_OFFERS_URL,
      source: "Exactas UBA",
      salary: extractField(contentHtml, "Remuneración") ?? "No especificado",
      closingDate: extractField(contentHtml, "Fecha de cierre"),
      tags,
      snippet: stripHtml(contentHtml.slice(contentHtml.indexOf(">") + 1)).slice(0, 3000),
    }];
  });
};

export const fetchExactasJobs = async (now = new Date()): Promise<CleanJob[]> => {
  const res = await fetch(EXACTAS_OFFERS_URL, { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`Exactas UBA respondió ${res.status}: ${res.statusText}`);
  }

  const offers = parseExactasOffers(await res.text());
  if (offers.length === 0) {
    throw new Error("No se encontró ninguna oferta en la página de Exactas UBA: es probable que haya cambiado su formato");
  }

  const openOffers = offers.filter((offer) => isStillOpen(offer, now));
  console.log(`Exactas UBA: ${offers.length} ofertas publicadas, ${openOffers.length} con la fecha de cierre sin vencer`);
  return openOffers;
};

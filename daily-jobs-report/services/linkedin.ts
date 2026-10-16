import type { CleanJob } from "../types.js";

export interface LinkedInSearchQuery {
  keywords: string;
  location: string;
  remote?: boolean;
  jobAgeDays?: number;
}

export interface LinkedInJobCard {
  id: string;
  title: string;
  company: string;
  location: string;
  publicationDate?: string | undefined;
  url: string;
}

export interface LinkedInFetchOptions {
  maxJobs?: number;
  filterCard?: (card: LinkedInJobCard) => boolean;
}

const SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const DETAIL_URL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";
const DEFAULT_MAX_JOBS = 10;
const DEFAULT_JOB_AGE_DAYS = 7;

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; linkedin-search-cli/1.0)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "X-Requested-With": "XMLHttpRequest",
};

const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const cp = parseInt(hex, 16);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const cp = parseInt(dec, 10);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
};

const stripTags = (html: string): string => {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
};

const extractDivContent = (html: string, className: string): string | null => {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const openRe = new RegExp(`<div[^>]*class="[^"]*${escaped}[^"]*"[^>]*>`, "i");
  const open = openRe.exec(html);
  if (!open) return null;

  let index = open.index + open[0].length;
  let depth = 1;

  while (depth > 0 && index < html.length) {
    const nextOpen = html.indexOf("<div", index);
    const nextClose = html.indexOf("</div>", index);

    if (nextClose === -1) return null;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      index = nextOpen + 4;
    } else {
      depth--;
      index = nextClose + 6;
    }
  }

  return html.slice(open.index + open[0].length, index - 6);
};

const hasClosedBannerInTopcard = (html: string): boolean => {
  const descStart = html.search(/class="(?:show-more-less-html__markup|description__text)/i);
  const topcard = descStart === -1 ? html : html.slice(0, descStart);
  return /closed-job__flavor|no longer accepting applications|ya no se aceptan solicitudes/i.test(topcard);
};

export const parseJobCards = (html: string): LinkedInJobCard[] => {
  const cards: LinkedInJobCard[] = [];
  const chunks = html.split(/data-entity-urn="urn:li:jobPosting:/).slice(1);

  for (const chunk of chunks) {
    const id = chunk.match(/^(\d+)/)?.[1];
    if (!id) continue;

    const rawUrl = chunk.match(/class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/i)?.[1];
    const url = rawUrl ? (decodeHtmlEntities(rawUrl).split("?")[0] || `https://www.linkedin.com/jobs/view/${id}`) : `https://www.linkedin.com/jobs/view/${id}`;

    const h3Title = chunk.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i)?.[1];
    const srTitle = chunk.match(/class="sr-only"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    const title = stripTags(h3Title ?? srTitle ?? "");
    if (!title) continue;

    const subtitle = chunk.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i)?.[1];
    const company = stripTags(subtitle ?? "") || "Empresa en LinkedIn";

    const locHtml = chunk.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    const location = stripTags(locHtml ?? "") || "Argentina";

    const publicationDate = chunk.match(/class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i)?.[1];

    cards.push({
      id,
      title,
      company,
      location,
      publicationDate,
      url,
    });
  }

  return cards;
};

export const pickCardsAcrossQueries = (
  cardsByQuery: LinkedInJobCard[][],
  maxJobs = DEFAULT_MAX_JOBS,
  filterCard?: (card: LinkedInJobCard) => boolean
): LinkedInJobCard[] => {
  const seenIds = new Set<string>();
  const picked: LinkedInJobCard[] = [];
  const longestResult = Math.max(0, ...cardsByQuery.map((cards) => cards.length));

  for (let index = 0; index < longestResult && picked.length < maxJobs; index++) {
    for (const cards of cardsByQuery) {
      const card = cards[index];
      if (!card || seenIds.has(card.id)) {
        continue;
      }
      if (filterCard && !filterCard(card)) {
        continue;
      }
      seenIds.add(card.id);
      picked.push(card);
      if (picked.length === maxJobs) {
        break;
      }
    }
  }

  return picked;
};

export const parseJobDetail = (detailHtml: string, card: LinkedInJobCard): CleanJob | null => {
  if (hasClosedBannerInTopcard(detailHtml)) {
    return null;
  }

  const descHtml =
    extractDivContent(detailHtml, "show-more-less-html__markup") ??
    extractDivContent(detailHtml, "description__text");

  if (!descHtml) {
    return null;
  }

  const description = stripTags(descHtml);
  if (!description) {
    return null;
  }

  const tags: string[] = [];
  const criteriaRe = /class="description__job-criteria-subheader"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?class="description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let match: RegExpExecArray | null;
  while ((match = criteriaRe.exec(detailHtml)) !== null) {
    const value = stripTags(match[2] ?? "");
    if (value) {
      tags.push(value);
    }
  }

  return {
    id: `linkedin-${card.id}`,
    title: card.title,
    company: card.company,
    location: card.location,
    url: card.url,
    source: "LinkedIn",
    salary: "No especificado",
    publicationDate: card.publicationDate,
    tags,
    snippet: description.slice(0, 700),
  };
};

const fetchHtmlWithRetry = async (url: string): Promise<string> => {
  const retryDelaysMs = [400, 800, 1600];

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    const res = await fetch(url, { headers: REQUEST_HEADERS });

    if (res.status === 429 || res.status >= 500) {
      const delay = retryDelaysMs[attempt];
      if (delay !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }

    if (!res.ok) {
      throw new Error(`LinkedIn respondió ${res.status}: ${res.statusText} (${url})`);
    }

    return res.text();
  }

  throw new Error(`LinkedIn falló tras reintentos (${url})`);
};

const buildSearchUrl = (query: LinkedInSearchQuery): string => {
  const params = new URLSearchParams({
    keywords: query.keywords,
    location: query.location,
    f_TPR: `r${(query.jobAgeDays ?? DEFAULT_JOB_AGE_DAYS) * 86400}`,
    start: "0",
  });
  if (query.remote) {
    params.set("f_WT", "2");
  }
  return `${SEARCH_URL}?${params.toString()}`;
};

export const fetchLinkedInJobs = async (
  queries: LinkedInSearchQuery[],
  options: LinkedInFetchOptions = {}
): Promise<CleanJob[]> => {
  const cardsByQuery: LinkedInJobCard[][] = [];

  for (const query of queries) {
    try {
      const html = await fetchHtmlWithRetry(buildSearchUrl(query));
      cardsByQuery.push(parseJobCards(html));
    } catch (error) {
      console.warn(`Aviso: la búsqueda "${query.keywords}" en LinkedIn falló:`, error);
    }
  }

  if (cardsByQuery.length === 0) {
    throw new Error("Fallaron todas las búsquedas en LinkedIn");
  }

  const maxJobs = options.maxJobs ?? DEFAULT_MAX_JOBS;
  const candidateCards = pickCardsAcrossQueries(cardsByQuery, Number.POSITIVE_INFINITY, options.filterCard);
  const jobs: CleanJob[] = [];
  let openDetailFetchedCount = 0;

  for (const card of candidateCards) {
    if (jobs.length >= maxJobs) {
      break;
    }
    try {
      const detailHtml = await fetchHtmlWithRetry(`${DETAIL_URL}/${card.id}`);
      if (hasClosedBannerInTopcard(detailHtml)) {
        continue;
      }
      openDetailFetchedCount++;
      const parsed = parseJobDetail(detailHtml, card);
      if (parsed) {
        jobs.push(parsed);
      }
    } catch (error) {
      console.warn(`Aviso: no se pudo leer el detalle ${card.id} de LinkedIn:`, error);
    }
  }

  if (openDetailFetchedCount > 0 && jobs.length === 0) {
    throw new Error("No se pudo interpretar ninguna oferta de LinkedIn: es probable que haya cambiado el formato de sus páginas");
  }

  return jobs;
};

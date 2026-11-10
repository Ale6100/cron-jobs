import { fetchGameGenres } from "./genres.js";
import type {
  CleanFreeGame,
  EpicFreeGamesReport,
  EpicGameElement,
  EpicGamesApiResponse,
  EpicPromotionalOfferItem,
} from "./types.js";

export const EPIC_FREE_GAMES_URL =
  "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=es-ES&country=AR&allowCountries=AR";

export const getEpicStoreSlug = (element: EpicGameElement): string | null => {
  return (
    element.offerMappings?.find((mapping) => mapping.pageType === "productHome")?.pageSlug ??
    element.offerMappings?.[0]?.pageSlug ??
    element.catalogNs?.mappings?.find((mapping) => mapping.pageType === "productHome")?.pageSlug ??
    element.catalogNs?.mappings?.[0]?.pageSlug ??
    (element.productSlug && element.productSlug !== "[]" ? element.productSlug : null) ??
    element.urlSlug ??
    null
  );
};

export const getEpicStoreUrl = (element: EpicGameElement): string => {
  if (element.url) {
    return element.url;
  }

  const pageSlug = getEpicStoreSlug(element);

  if (pageSlug) {
    return `https://store.epicgames.com/es-ES/p/${pageSlug}`;
  }

  return "https://store.epicgames.com/es-ES/free-games";
};

const formatOriginalPrice = (element: EpicGameElement): string => {
  const numeric = element.price?.totalPrice?.originalPrice ?? 0;
  if (numeric <= 0) {
    return "Free-to-play";
  }

  const fmt = element.price?.totalPrice?.fmtPrice?.originalPrice;
  if (fmt && fmt.trim() !== "" && fmt !== "0") {
    return fmt;
  }

  return `$${(numeric / 100).toFixed(2)} USD`;
};

const isZeroDiscount = (promo: EpicPromotionalOfferItem): boolean => {
  return promo.discountSetting?.discountPercentage === 0;
};

export const parseEpicFreeGames = (data: EpicGamesApiResponse, now = new Date()): EpicFreeGamesReport => {
  const elements = data.data?.Catalog?.searchStore?.elements ?? [];
  const currentGames: CleanFreeGame[] = [];
  const upcomingGames: CleanFreeGame[] = [];

  for (const element of elements) {
    const originalPrice = formatOriginalPrice(element);
    const url = getEpicStoreUrl(element);
    const slug = getEpicStoreSlug(element) ?? undefined;

    const activePromos =
      element.promotions?.promotionalOffers?.flatMap((group) => group.promotionalOffers ?? []) ?? [];

    const activePromo = activePromos.find((promo) => {
      const start = new Date(promo.startDate);
      const end = new Date(promo.endDate);
      const isWithinTimeRange = start.getTime() <= now.getTime() && now.getTime() <= end.getTime();
      return isWithinTimeRange && isZeroDiscount(promo);
    });

    if (activePromo) {
      currentGames.push({
        title: element.title,
        originalPrice,
        url,
        startDate: activePromo.startDate,
        endDate: activePromo.endDate,
        genres: [],
        slug,
      });
      continue;
    }

    const upcomingPromos =
      element.promotions?.upcomingPromotionalOffers?.flatMap((group) => group.promotionalOffers ?? []) ?? [];

    const upcomingPromo = upcomingPromos.find((promo) => {
      const start = new Date(promo.startDate);
      const isFuture = start.getTime() > now.getTime();
      return isFuture && isZeroDiscount(promo);
    });

    if (upcomingPromo) {
      upcomingGames.push({
        title: element.title,
        originalPrice,
        url,
        startDate: upcomingPromo.startDate,
        endDate: upcomingPromo.endDate,
        genres: [],
        slug,
      });
    }
  }

  return {
    currentGames,
    upcomingGames,
  };
};

export const fetchEpicFreeGames = async (options?: {
  now?: Date;
  url?: string;
}): Promise<EpicFreeGamesReport> => {
  const url = options?.url ?? EPIC_FREE_GAMES_URL;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Epic Games API respondió ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as EpicGamesApiResponse;
  const report = parseEpicFreeGames(json, options?.now);

  for (const game of report.currentGames) {
    game.genres = await fetchGameGenres(game.title, game.slug);
  }

  for (const game of report.upcomingGames) {
    game.genres = await fetchGameGenres(game.title, game.slug);
  }

  return report;
};

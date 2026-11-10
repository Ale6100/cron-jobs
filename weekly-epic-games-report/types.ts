export interface EpicDiscountSetting {
  discountType?: string;
  discountPercentage?: number;
}

export interface EpicPromotionalOfferItem {
  startDate: string;
  endDate: string;
  discountSetting?: EpicDiscountSetting;
}

export interface EpicPromotionalOfferGroup {
  promotionalOffers?: EpicPromotionalOfferItem[];
}

export interface EpicGamePromotions {
  promotionalOffers?: EpicPromotionalOfferGroup[];
  upcomingPromotionalOffers?: EpicPromotionalOfferGroup[];
}

export interface EpicGamePrice {
  totalPrice?: {
    discountPrice?: number;
    originalPrice?: number;
    fmtPrice?: {
      originalPrice?: string;
      discountPrice?: string;
    };
  };
}

export interface EpicPageMapping {
  pageSlug?: string;
  pageType?: string;
}

export interface EpicGameElement {
  id?: string;
  title: string;
  description?: string;
  productSlug?: string | null;
  urlSlug?: string;
  url?: string | null;
  offerType?: string;
  offerMappings?: EpicPageMapping[];
  catalogNs?: {
    mappings?: EpicPageMapping[];
  };
  price?: EpicGamePrice;
  promotions?: EpicGamePromotions | null;
}

export interface EpicGamesApiResponse {
  data?: {
    Catalog?: {
      searchStore?: {
        elements?: EpicGameElement[];
      };
    };
  };
}

export interface CleanFreeGame {
  title: string;
  originalPrice: string;
  url: string;
  startDate: string;
  endDate: string;
  genres: string[];
  slug?: string | undefined;
}

export interface EpicFreeGamesReport {
  currentGames: CleanFreeGame[];
  upcomingGames: CleanFreeGame[];
}

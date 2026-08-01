export type Deal = {
  price: string;
  percentageDiscount: number;
  title: string;
  url: string;
}

export type RawDeal = {
  price: number;
  percentageDiscount: number;
  title: string;
  url: string;
};

export const MIN_DISCOUNT_PERCENTAGE = 70;

// Remueve parámetros sobrantes (? y #) de las URLs
export const cleanUrl = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl;
  }
};

import { newPage } from '../browser.js';
import { formatPrice } from '../../utils/util.js';
import { MIN_DISCOUNT_PERCENTAGE } from '../util.js';
import type { Deal, RawDeal } from '../util.js';

export const getDealsMercadoLibre = async ({ pageNumber = 1 }: { pageNumber?: number }) => {
  const page = await newPage();

  try {
    const url = `https://www.mercadolibre.com.ar/ofertas?page=${pageNumber}&shipping_cost=free`
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('div.items-list div.poly-card', { timeout: 30000 });

    const rawDeals: RawDeal[] = await page.evaluate(() => {
      const dataContainer = document.querySelector('div.items-list');
      if (!dataContainer) return [];

      return Array.from(dataContainer.querySelectorAll('div.poly-card')).map((item) => {
        const title = item.querySelector('.poly-component__title')?.textContent?.trim() ?? '';
        const priceText = item.querySelector('.poly-price__current .andes-money-amount__fraction')?.textContent?.trim() ?? '';
        const percentageDiscountText = item.querySelector('.poly-price__labels .polylabel-pill')?.textContent?.trim() ?? '';
        const url = item.querySelector('.poly-component__title')?.getAttribute('href') ?? '';

        return {
          price: Number(priceText.replace(/\D/g, '')),
          percentageDiscount: Number(percentageDiscountText.replace(/\D/g, '')),
          title,
          url,
        };
      });
    });

    return rawDeals.filter((deal) => deal.percentageDiscount >= MIN_DISCOUNT_PERCENTAGE).map(({ price, ...deal }): Deal => ({
      ...deal,
      price: formatPrice(price, false),
    }));
  } catch (error) {
    console.error(error);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

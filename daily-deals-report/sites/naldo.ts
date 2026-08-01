import { newPage } from '../browser.js';
import { formatPrice } from '../../utils/util.js';
import { MIN_DISCOUNT_PERCENTAGE } from '../util.js';
import type { Deal, RawDeal } from '../util.js';

export const getDealsNaldo = async ({ pageNumber = 1 }: { pageNumber?: number } = {}) => {
  const page = await newPage();

  try {
    const url = `https://www.naldo.com.ar/790?O=OrderByReleaseDateDESC&map=productClusterIds&order=&page=${pageNumber}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#gallery-layout-container div.naldoar-search-result-3-x-galleryItem', { timeout: 30000 });

    const rawDeals: RawDeal[] = await page.evaluate(() => {
      const dataContainer = document.querySelector('#gallery-layout-container');
      if (!dataContainer) return [];

      return Array.from(dataContainer.querySelectorAll('div.naldoar-search-result-3-x-galleryItem')).map((item) => {
        const title = item.querySelector('h3 span.vtex-product-summary-2-x-productBrand')?.textContent?.trim() ?? '';
        const priceText = item.querySelector('span.vtex-product-price-1-x-sellingPrice')?.textContent?.trim() ?? '';
        const percentageDiscountText = item.querySelector('span.vtex-product-price-1-x-savingsPercentage')?.textContent?.trim() ?? '';
        const url = item.querySelector('a.vtex-product-summary-2-x-clearLink')?.getAttribute('href') ?? '';

        return {
          price: Number(priceText.replace(/\D/g, '')),
          percentageDiscount: Number(percentageDiscountText.replace(/\D/g, '')),
          title,
          url: `https://www.naldo.com.ar${url}`,
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

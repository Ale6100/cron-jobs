import { newPage } from '../browser.js';
import { formatPrice } from '../../utils/util.js';
import { MIN_DISCOUNT_PERCENTAGE } from '../util.js';
import type { Deal, RawDeal } from '../util.js';

export const getDealsTiendaBna = async ({ pageNumber = 1 }: { pageNumber?: number }) => {
  const page = await newPage();

  try {
    const url = `https://www.tiendabna.com.ar/catalog/ofertas-imperdibles?query=&o=popular-desc&p=${pageNumber}`
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('div.variants-list article#modern-variant-card', { timeout: 30000 });

    const rawDeals: RawDeal[] = await page.evaluate(() => {
      const dataContainer = document.querySelector('div.variants-list');
      if (!dataContainer) return [];

      return Array.from(dataContainer.querySelectorAll('article#modern-variant-card')).map((item) => {
        const title = item.querySelector('h6')?.textContent?.trim() ?? '';
        const priceText = item.querySelector('.sale-price')?.textContent?.trim() ?? '';
        const percentageDiscountText = item.querySelector('span.badge-sale-price')?.textContent?.trim() ?? '';
        const url = item.querySelector('a.img')?.getAttribute('href') ?? '';

        return {
          price: Number(priceText.replace(/\D/g, '')),
          percentageDiscount: Number(percentageDiscountText.replace(/\D/g, '')),
          title,
          url: `https://www.tiendabna.com.ar${url}`,
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

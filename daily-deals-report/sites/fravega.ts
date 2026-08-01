import { newPage } from '../browser.js';
import { formatPrice } from '../../utils/util.js';
import { MIN_DISCOUNT_PERCENTAGE } from '../util.js';
import type { Deal, RawDeal } from '../util.js';

const url = 'https://www.fravega.com/l/?promociones=ofertas-semanales&descuento=desde-70-off&free-cost=FREE_COST&tipo-de-entrega=envio-a-domicilio'

export const getDealsFravega = async () => {
  const page = await newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const rawDeals: RawDeal[] = await page.evaluate(() => {
      const dataContainer = document.querySelector('ul[data-test-id="results-list"]');
      if (!dataContainer) return [];

      return Array.from(dataContainer.querySelectorAll('article[data-test-id="result-item"]')).map((item) => {
        const title = item.querySelector('[data-test-id="article-title"] span')?.textContent?.trim() ?? '';
        const priceText = item.querySelector('div[data-test-id="product-price"] > div > span')?.textContent?.trim() ?? '';
        const percentageDiscountText = item.querySelector('[data-test-id="discount-tag"]')?.textContent?.trim() ?? '';
        const url = item.querySelector('a[rel="bookmark"]')?.getAttribute('href') ?? '';

        return {
          price: Number(priceText.replace(/\D/g, '')),
          percentageDiscount: Number(percentageDiscountText.replace(/\D/g, '')),
          title,
          url: `https://www.fravega.com${url}`,
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

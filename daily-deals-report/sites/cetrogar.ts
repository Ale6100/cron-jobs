import { newPage } from '../browser.js';
import { formatPrice } from '../../utils/util.js';
import { MIN_DISCOUNT_PERCENTAGE } from '../util.js';
import type { Deal, RawDeal } from '../util.js';

const url = 'https://www.cetrogar.com.ar/s?fuzzy=0&operator=and&tipo-de-oferta=oferta&facets=fuzzy%2Coperator%2Ctipo-de-oferta&sort=discount_desc&page=0'

export const getDealsCetrogar = async () => {
  const page = await newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('ul[data-fs-product-grid="true"] li[data-fs-product-grid-item="true"]', { timeout: 30000 });

    const rawDeals: RawDeal[] = await page.evaluate(() => {
      const dataContainer = document.querySelector('ul[data-fs-product-grid="true"]');
      if (!dataContainer) return [];

      return Array.from(dataContainer.querySelectorAll('li[data-fs-product-grid-item="true"]')).map((item) => {
        const title = item.querySelector('h3[data-fs-product-card-title="true"] a span')?.textContent?.trim() ?? '';
        const priceValue = item.querySelector<HTMLElement>('[data-testid="price"]')?.dataset.value ?? '';
        const percentageDiscountText = item.querySelector('[data-testid="fs-discount-badge"]')?.textContent?.trim() ?? '';
        const url = item.querySelector('a[data-testid="product-link"]')?.getAttribute('href') ?? '';

        return {
          price: Number(priceValue.replace(/\D/g, '')),
          percentageDiscount: Number(percentageDiscountText.replace(/\D/g, '')),
          title,
          url: `https://www.cetrogar.com.ar${url}`,
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

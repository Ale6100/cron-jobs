import { newPage } from '../browser.js';
import { formatPrice } from '../../utils/util.js';
import { MIN_DISCOUNT_PERCENTAGE } from '../util.js';
import type { Deal, RawDeal } from '../util.js';

const url = 'https://www.coppel.com.ar/electrodomesticos?orden=orderbybestdiscountdesc';

export const getDealsCoppel = async () => {
  const page = await newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.vtex-render__container-id-searchv2 a[id^="product-card-"]', { timeout: 30000 });

    const rawDeals: RawDeal[] = await page.evaluate(() => {
      const dataContainer = document.querySelector('.vtex-render__container-id-searchv2');
      if (!dataContainer) return [];

      return Array.from(dataContainer.querySelectorAll('a[id^="product-card-"]')).map((item) => {
        const title = item.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const priceText = item.querySelector('span[style*="--rojo-700"]')?.textContent?.trim() ?? '';
        const discountText =
          Array.from(item.querySelectorAll('span')).find((span) => /^\s*\d+%\s*OFF\s*$/.test(span.textContent ?? ''))?.textContent?.trim() ?? '';
        const url = item.getAttribute('href') ?? '';

        return {
          price: Number(priceText.replace(/\D/g, '')),
          percentageDiscount: Number(discountText.replace(/\D/g, '')),
          title,
          url: `https://www.coppel.com.ar${url}`,
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

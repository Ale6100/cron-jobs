import { newPage } from '../browser.js';
import { formatPrice } from '../../utils/util.js';
import { MIN_DISCOUNT_PERCENTAGE } from '../util.js';
import type { Deal, RawDeal } from '../util.js';

const url = 'https://www.lenovo.com/ar/es/d/ofertas/?sortBy=savingPercent'

export const getDealsLenovo = async () => {
  const page = await newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('li.product_item[data-product-code] .price-title:not(:empty)', { timeout: 30000 });

    const rawDeals: RawDeal[] = await page.evaluate(() => {
      const dataContainer = document.querySelector('div.product_list');
      if (!dataContainer) return [];

      return Array.from(dataContainer.querySelectorAll('li.product_item[data-product-code]')).map((item) => {
        const title = item.querySelector('.product_title a')?.textContent?.trim().replaceAll(/\s+/g, ' ') ?? '';
        const priceText = item.querySelector('.price-title')?.textContent?.trim() ?? '';
        const percentageDiscountText = item.querySelector('[data-tkey="off"]')?.textContent?.trim() ?? '';
        const url = item.querySelector('.product_title a')?.getAttribute('href') ?? '';

        return {
          price: Number(priceText.replaceAll('$', '').replaceAll('.', '').replaceAll(',', '.')),
          percentageDiscount: Number(percentageDiscountText.replace(/\D/g, '')),
          title,
          url: `https://www.lenovo.com${url}`,
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

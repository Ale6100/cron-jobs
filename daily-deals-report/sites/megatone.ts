import { newPage } from '../browser.js';
import { formatPrice } from '../../utils/util.js';
import { MIN_DISCOUNT_PERCENTAGE } from '../util.js';
import type { Deal, RawDeal } from '../util.js';

const url = 'https://www.megatone.net/landing/ofertas-del-dia/?ordenar=o_off'

export const getDealsMegatone = async () => {
  const page = await newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#ListadoProductos a.CajaProductoGrilla', { timeout: 30000 });

    const rawDeals: RawDeal[] = await page.evaluate(() => {
      const dataContainer = document.querySelector('#ListadoProductos');
      if (!dataContainer) return [];

      return Array.from(dataContainer.querySelectorAll('a.CajaProductoGrilla')).map((item) => {
        const titleEl = item.querySelector('h3.TituloListado');
        const marca = titleEl?.querySelector('.LeyendaMarca')?.textContent?.trim() ?? '';
        let title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (marca && title.endsWith(marca)) {
          title = title.slice(0, -marca.length).trim();
        }
        const priceText = item.querySelector('.preciosContainer .fLeft.Precio')?.textContent?.trim() ?? '';
        const percentageDiscountText = item.querySelector('.burbujaDescuento .estiloPorcentajeDescuento')?.textContent?.trim() ?? '';
        const url = item.getAttribute('href') ?? '';

        return {
          price: Number(priceText.replace(/\D/g, '')),
          percentageDiscount: Number(percentageDiscountText.replace(/\D/g, '')),
          title,
          url: `https://www.megatone.net${url}`,
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

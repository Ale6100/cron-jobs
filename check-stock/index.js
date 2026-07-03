import puppeteer from 'puppeteer';
import { sendMessage } from '../utils/sendMessage.js';

const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

const url = 'https://www.worldargentina.com.ar/productos/tarjeta-de-proximidad-hid-prox-card-ii';

async function hayStock() {
    const browser = await puppeteer.launch({ headless: 'shell' });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        const stockDisponible = await page.evaluate(() => {
            const elemento = document.querySelector('.product-image-container .js-stock-label-private');

            if (elemento) {
                const cartelSinStockVisible = elemento.offsetParent !== null && elemento.dataset.label === 'Sin stock';
                return !cartelSinStockVisible;
            }

            return true;
        });

        return stockDisponible;

    } catch (error) {
        console.error(error);
        return false;
    } finally {
        await browser.close();
    }
}

const main = async () => {
  const hay = await hayStock();

  if (!hay) return console.log('No hay stock disponible :C');

  console.log('Hay stock disponible');

  await sendMessage({
    phone: WHATSAPP_PHONE,
    apikey: WHATSAPP_API_KEY,
    text: `📈 La maleducada *Tarjeta de Proximidad* por fin tiene stock disponible: ${url}`
  });
}

main();

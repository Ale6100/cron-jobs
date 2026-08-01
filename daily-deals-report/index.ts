import { getDealsFravega } from "./sites/fravega.js";
import { sendMessageTelegram } from '../utils/sendMessage.js';
import { getDealsCetrogar } from "./sites/cetrogar.js";
import { getDealsLenovo } from "./sites/lenovo.js";
import { getDealsMercadoLibre } from "./sites/mercadoLibre.js";
import { getDealsTiendaBna } from "./sites/tiendaBna.js";
import { getDealsNaldo } from "./sites/naldo.js";
import { getDealsMegatone } from "./sites/megatone.js";
import { getDealsCoppel } from "./sites/coppel.js";
import { closeBrowser } from "./browser.js";
import { cleanUrl } from "./util.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Faltan variables de entorno necesarias para ejecutar el script");
  process.exit(1);
}

const [
  dealsFravega,
  dealsCetrogar,
  dealsLenovo,
  dealsMercadoLibre1,
  dealsMercadoLibre2,
  dealsMercadoLibre3,
  dealsMercadoLibre4,
  dealsMercadoLibre5,
  dealsTiendaBna1,
  dealsTiendaBna2,
  dealsTiendaBna3,
  dealsTiendaBna4,
  dealsTiendaBna5,
  dealsNaldo1,
  dealsNaldo2,
  dealsNaldo3,
  dealsNaldo4,
  dealsNaldo5,
  dealsMegatone,
  dealsCoppel
] = await Promise.all([
  getDealsFravega(),
  getDealsCetrogar(),
  getDealsLenovo(),
  getDealsMercadoLibre({ pageNumber: 1 }),
  getDealsMercadoLibre({ pageNumber: 2 }),
  getDealsMercadoLibre({ pageNumber: 3 }),
  getDealsMercadoLibre({ pageNumber: 4 }),
  getDealsMercadoLibre({ pageNumber: 5 }),
  getDealsTiendaBna({ pageNumber: 1 }),
  getDealsTiendaBna({ pageNumber: 2 }),
  getDealsTiendaBna({ pageNumber: 3 }),
  getDealsTiendaBna({ pageNumber: 4 }),
  getDealsTiendaBna({ pageNumber: 5 }),
  getDealsNaldo({ pageNumber: 1 }),
  getDealsNaldo({ pageNumber: 2 }),
  getDealsNaldo({ pageNumber: 3 }),
  getDealsNaldo({ pageNumber: 4 }),
  getDealsNaldo({ pageNumber: 5 }),
  getDealsMegatone(),
  getDealsCoppel(),
]);

await closeBrowser();

const dealsMercadoLibre = [...dealsMercadoLibre1, ...dealsMercadoLibre2, ...dealsMercadoLibre3, ...dealsMercadoLibre4, ...dealsMercadoLibre5];
const dealsTiendaBna = [...dealsTiendaBna1, ...dealsTiendaBna2, ...dealsTiendaBna3, ...dealsTiendaBna4, ...dealsTiendaBna5];
const dealsNaldo = [...dealsNaldo1, ...dealsNaldo2, ...dealsNaldo3, ...dealsNaldo4, ...dealsNaldo5];
const deals = [...dealsFravega, ...dealsCetrogar, ...dealsLenovo, ...dealsMercadoLibre, ...dealsTiendaBna, ...dealsNaldo, ...dealsMegatone, ...dealsCoppel];

if (deals.length === 0) {
  console.log("No se encontraron ofertas para enviar");
  process.exit(0);
}

console.log(deals);

let messageText = "Ofertas del día:\n\n";

const SEPARADOR_TIENDA = "\n━━━━━━━━━━━━━━━━\n\n";

const plantilla = ({ title, price, percentageDiscount, url }: { title: string; price: string; percentageDiscount: number; url: string }): string => {
  return `
- *${title}*
- *${price}* (${percentageDiscount}% OFF)
- ${cleanUrl(url)}
`;
};

if (dealsFravega.length > 0) {
  messageText += "*Frávega*:";
  dealsFravega.forEach((deal) => {
    messageText += plantilla(deal);
  });
}

if (dealsCetrogar.length > 0) {
  messageText += `${SEPARADOR_TIENDA}*Cetrogar*:`;
  dealsCetrogar.forEach((deal) => {
    messageText += plantilla(deal);
  });
}

if (dealsLenovo.length > 0) {
  messageText += `${SEPARADOR_TIENDA}*Lenovo*:`;
  dealsLenovo.forEach((deal) => {
    messageText += plantilla(deal);
  });
}

if (dealsMercadoLibre.length > 0) {
  messageText += `${SEPARADOR_TIENDA}*Mercado Libre*:`;
  dealsMercadoLibre.forEach((deal) => {
    messageText += plantilla(deal);
  });
}

if (dealsTiendaBna.length > 0) {
  messageText += `${SEPARADOR_TIENDA}*Tienda BNA*:`;
  dealsTiendaBna.forEach((deal) => {
    messageText += plantilla(deal);
  });
}

if (dealsNaldo.length > 0) {
  messageText += `${SEPARADOR_TIENDA}*Naldo*:`;
  dealsNaldo.forEach((deal) => {
    messageText += plantilla(deal);
  });
}

if (dealsMegatone.length > 0) {
  messageText += `${SEPARADOR_TIENDA}*Megatone*:`;
  dealsMegatone.forEach((deal) => {
    messageText += plantilla(deal);
  });
}

if (dealsCoppel.length > 0) {
  messageText += `${SEPARADOR_TIENDA}*Coppel*:`;
  dealsCoppel.forEach((deal) => {
    messageText += plantilla(deal);
  });
}

try {
  await sendMessageTelegram({
    token: TELEGRAM_BOT_TOKEN,
    chatId: TELEGRAM_CHAT_ID,
    text: messageText,
  });
} catch (error) {
  console.error("No se pudo enviar el mensaje de ofertas:", error);
  try {
    await sendMessageTelegram({
      token: TELEGRAM_BOT_TOKEN,
      chatId: TELEGRAM_CHAT_ID,
      text: `Se cayó la app Ofertas del día: no se pudo mandar el mensaje con las ofertas (${messageText.length} caracteres). Error: ${error instanceof Error ? error.message : error}`,
    });
  } catch (error_) {
    console.error("Tampoco se pudo enviar el aviso de error:", error_);
    process.exit(1);
  }
}

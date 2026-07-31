import { getData } from "./utils/getData.js";
import { sendMessage } from "../utils/sendMessage.js";
import { formatPrice } from "../utils/util.js";

const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
const URL_BACKEND = process.env.URL_BACKEND;
const CRON_API_KEY = process.env.CRON_API_KEY;

const main = async () => {
  if (!WHATSAPP_PHONE || !WHATSAPP_API_KEY || !URL_BACKEND || !CRON_API_KEY) {
    return console.error("Faltan variables de entorno necesarias para ejecutar el script");
  }

  const response = await getData({
    url: URL_BACKEND,
    apiKey: CRON_API_KEY,
  })

  if (response?.statusCode != 200) return console.error(JSON.stringify(response));
  if (!response?.data) return console.error("Datos no encontrados en la respuesta del backend");

  const { gastosPendientes } = response.data;

  if (gastosPendientes.length === 0) return;

  const message = `
  💲*GASTOS PENDIENTES*
  ${gastosPendientes.map(gasto => `- ${gasto.nombre}: *${formatPrice(gasto.monto)}*`).join("\n")}
  `

  await sendMessage({
    phone: WHATSAPP_PHONE,
    apikey: WHATSAPP_API_KEY,
    text: message
  });
}

main();

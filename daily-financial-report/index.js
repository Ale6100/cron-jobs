import { getData } from "./utils/getData.js";
import { sendMessage } from "../utils/sendMessage.js";
import { formatPrice } from "../utils/util.js";

const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
const URL_BACKEND = process.env.URL_BACKEND;
const CRON_API_KEY = process.env.CRON_API_KEY;

const main = async () => {
  const response = await getData({
    url: URL_BACKEND,
    apiKey: CRON_API_KEY,
  })

  if (response?.statusCode != 200) return console.error(JSON.stringify(response));
  if (!response?.data) return console.error("Datos no encontrados en la respuesta del backend");

  const { gastoDiario, balanceAlDiaDeHoy, gastosPendientes } = response.data;

  const gastosPendientesMessage = gastosPendientes.length > 0
    ? `- Gastos pendientes:\n${gastosPendientes.map(gasto => `  - ${gasto.nombre}: *${formatPrice(gasto.columnaMonto)}*`).join("\n")}`
    : "- No hay gastos pendientes.";

  const message = `
  💲*RESUMEN FINANCIERO DIARIO*
  - Al finalizar el día de hoy, deberías tener *${formatPrice(balanceAlDiaDeHoy)}* en tu cuenta.

  - Hoy deberías gastar menos de *${formatPrice(gastoDiario)}*

  ${gastosPendientesMessage}
  `

  await sendMessage({
    phone: WHATSAPP_PHONE,
    apikey: WHATSAPP_API_KEY,
    text: message
  });
}

main();

import { Bot, GrammyError } from 'grammy';

type SendMessageParams = {
  phone: string;
  apikey: string;
  text: string;
}

export const sendMessage = async ({ phone, apikey, text }: SendMessageParams) => {
  const queryString = new URLSearchParams({
    phone,
    text,
    apikey,
  }).toString();

  const res = await fetch(`https://api.callmebot.com/whatsapp.php?${queryString}`);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`callmebot respondió ${res.status}: ${body}`);
  }
  console.log(`Mensaje enviado: ${body}`);
}

type SendMessageTelegramParams = {
  token: string;
  chatId: string;
  text: string;
}

export const sendMessageTelegram = async ({ token, chatId, text }: SendMessageTelegramParams) => {
  const bot = new Bot(token, {
    client: {
      fetch: globalThis.fetch,
    },
  });

  try {
    const message = await bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    console.log(`Mensaje enviado a Telegram (message_id ${message.message_id})`);
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 400 && error.description.includes("can't parse entities")) {
      console.warn(`Aviso: Telegram rechazó parse_mode 'Markdown' (${error.description}). Reenviando mensaje como texto plano...`);
      const fallbackMessage = await bot.api.sendMessage(chatId, text);
      console.log(`Mensaje enviado a Telegram en texto plano (message_id ${fallbackMessage.message_id})`);
      return;
    }
    throw error;
  }
};

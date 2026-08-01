import { Bot } from 'grammy';

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
  const bot = new Bot(token);

  const message = await bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  console.log(`Mensaje enviado a Telegram (message_id ${message.message_id})`);
}

export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

export const splitIntoMessages = (header: string, items: string[], maxLength = TELEGRAM_MAX_MESSAGE_LENGTH): string[] => {
  const messages: string[] = [];
  let currentMessage = header;

  for (const item of items) {
    if (currentMessage !== header && currentMessage.length + item.length > maxLength) {
      messages.push(currentMessage);
      currentMessage = "";
    }
    currentMessage += item;
  }

  messages.push(currentMessage);
  return messages;
};

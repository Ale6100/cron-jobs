// type SendMessageParams = {
//   phone: string;
//   apikey: string;
//   text: string;
// }

export const sendMessage = async ({ phone, apikey, text }) => {
  const queryString = new URLSearchParams({
    phone,
    text,
    apikey,
  }).toString();

  await fetch(`https://api.callmebot.com/whatsapp.php?${queryString}`);
}

// type getDataResponse = {
//   statusCode: number;
//   message?: string[] | string;
//   data?: {
//     gastoDiario: number;
//     balanceAlDiaDeHoy: number;
//     gastosPendientes: {
//       nombre: string;
//       columnaMonto: number;
//     }[]
//   };
// }

// type GetDataParams = {
//   url: string;
//   apiKey: string;
// };

export const getData = async ({ url, apiKey }) => {
  return await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
  }).then((res) => res.json());
}

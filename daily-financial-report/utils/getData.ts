type getDataResponse = {
  statusCode: number;
  message?: string[] | string;
  data?: {
    gastoDiario: number;
    balanceAlDiaDeHoy: number;
    gastosPendientes: {
      nombre: string;
      monto: number;
    }[]
  };
}

type GetDataParams = {
  url: string;
  apiKey: string;
};

export const getData = async ({ url, apiKey }: GetDataParams) => {
  return await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
  }).then((res) => res.json()) as Promise<getDataResponse>;
}

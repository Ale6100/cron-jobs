export const getDolarPrice = async (): Promise<number> => {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue");
    if (!res.ok) {
      throw new Error(`DolarApi respondió ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as { venta?: number };
    if (data.venta && data.venta > 0) {
      return data.venta;
    }
  } catch (error) {
    console.warn("Aviso: No se pudo obtener la cotización del dólar en vivo, utilizando valor de respaldo:", error);
  }
  return 1500; // Valor de respaldo seguro ante caídas de la API de cotización
};

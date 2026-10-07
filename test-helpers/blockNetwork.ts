import net from "node:net";

// Se carga antes de cada test: ningún test debe tocar servicios reales, así que cualquier conexión sin simular falla.
// Además de fetch se bloquea la conexión TCP de bajo nivel, porque algunas librerías (ej: grammy) no usan el fetch global.
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = input instanceof Request ? input.url : String(input);
  throw new Error(`Los tests no pueden hacer requests reales (fetch sin simular a ${url})`);
}) as typeof fetch;

net.Socket.prototype.connect = function () {
  throw new Error("Los tests no pueden abrir conexiones de red reales");
};

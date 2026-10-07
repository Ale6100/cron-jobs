import net from "node:net";

globalThis.fetch = (async (input: string | URL | Request) => {
  const url = input instanceof Request ? input.url : String(input);
  throw new Error(`Los tests no pueden hacer requests reales (fetch sin simular a ${url})`);
}) as typeof fetch;

// Algunas librerías (ej: grammy) no usan el fetch global, así que también se bloquea la conexión TCP de bajo nivel
net.Socket.prototype.connect = function () {
  throw new Error("Los tests no pueden abrir conexiones de red reales");
};

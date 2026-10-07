import { mock } from "node:test";

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

export const mockFetch = (handler: FetchHandler) => {
  return mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return handler(url, init);
  });
};

export const jsonResponse = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
};

export const htmlResponse = (body: string, status = 200): Response => {
  return new Response(body, { status, headers: { "Content-Type": "text/html" } });
};

export const silenceConsole = () => {
  mock.method(console, "log", () => {});
  mock.method(console, "warn", () => {});
  mock.method(console, "error", () => {});
};

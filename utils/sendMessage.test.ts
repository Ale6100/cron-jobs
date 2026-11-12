import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jsonResponse, mockFetch, silenceConsole } from "../test-helpers/mockFetch.js";
import { sendMessageTelegram } from "./sendMessage.js";

interface TelegramRequestBody {
  chat_id?: string;
  text?: string;
  parse_mode?: string;
}

describe("sendMessageTelegram", () => {
  silenceConsole();

  it("envía el mensaje a Telegram con formato Markdown", async () => {
    const requests: { url: string; body: TelegramRequestBody | null }[] = [];

    mockFetch(async (url, init) => {
      requests.push({ url, body: init?.body ? (JSON.parse(String(init.body)) as TelegramRequestBody) : null });
      return jsonResponse({ ok: true, result: { message_id: 101 } });
    });

    await sendMessageTelegram({
      token: "test-token",
      chatId: "12345",
      text: "*Hola*",
    });

    assert.equal(requests.length, 1);
    const req = requests[0]!;
    assert.match(req.url, /bottest-token\/sendMessage$/);
    assert.deepEqual(req.body, {
      chat_id: "12345",
      text: "*Hola*",
      parse_mode: "Markdown",
    });
  });

  it("si falla por parseo de entidades Markdown, reenvía en texto plano", async () => {
    const requests: { url: string; body: TelegramRequestBody | null }[] = [];

    mockFetch(async (url, init) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as TelegramRequestBody) : null;
      requests.push({ url, body });

      if (requests.length === 1) {
        return jsonResponse(
          {
            ok: false,
            error_code: 400,
            description: "Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 581",
          },
          400
        );
      }

      return jsonResponse({ ok: true, result: { message_id: 102 } });
    });

    await sendMessageTelegram({
      token: "test-token",
      chatId: "12345",
      text: "Mensaje con _sin cerrar",
    });

    assert.equal(requests.length, 2);
    const firstReq = requests[0]!;
    const secondReq = requests[1]!;
    assert.equal(firstReq.body?.parse_mode, "Markdown");
    assert.equal(secondReq.body?.parse_mode, undefined);
    assert.equal(secondReq.body?.text, "Mensaje con _sin cerrar");
  });

  it("si falla por otro error (ej: 401 Unauthorized), relanza el error sin reintentar", async () => {
    const requests: unknown[] = [];

    mockFetch(async (_url, init) => {
      requests.push(init?.body);
      return jsonResponse(
        {
          ok: false,
          error_code: 401,
          description: "Unauthorized",
        },
        401
      );
    });

    await assert.rejects(
      async () => {
        await sendMessageTelegram({
          token: "bad-token",
          chatId: "12345",
          text: "Hola",
        });
      },
      /401/
    );

    assert.equal(requests.length, 1);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatJobItem, formatJobsReportErrorMessage, formatSalary, splitIntoMessages } from "./message.js";
import type { JobMatch } from "./services/gemini.js";
import type { PayFormat } from "./types.js";

const dummyPayFormat: PayFormat = {
  formatPay: (val) => `~$${val} USD/h`,
};

const dummyJob: JobMatch = {
  id: "freehire-123",
  title: "Full Stack Engineer *Pro*",
  company: "OpsBox_AI",
  location: "Remoto [Argentina]",
  url: "https://torre.ai/post/8wDaBZld-opsbox-ai-full-stack-engineer?utm_source=freehire.me&ref_id=1",
  source: "FreeHire",
  score: 9.5,
  reason: "Buen encaje con Node_js y React*.",
  estimatedPay: 25.5,
};

describe("splitIntoMessages", () => {
  it("arma un solo mensaje si todo entra en el límite", () => {
    assert.deepEqual(splitIntoMessages("H", ["a", "b"], 10), ["Hab"]);
  });

  it("parte entre ofertas sin cortar ninguna y deja el encabezado solo en el primero", () => {
    assert.deepEqual(splitIntoMessages("HH", ["aaaa", "bbbb", "cccc"], 10), ["HHaaaabbbb", "cccc"]);
  });

  it("no deja el encabezado solo aunque la primera oferta supere el límite", () => {
    assert.deepEqual(splitIntoMessages("HH", ["aaaaaaaaaa", "b"], 10), ["HHaaaaaaaaaa", "b"]);
  });
});

describe("formatSalary", () => {
  it("formatea el salario cuando es mayor a 0", () => {
    assert.equal(formatSalary(dummyJob, dummyPayFormat), "~$25.5 USD/h");
  });

  it("devuelve 'A convenir / No especificado' cuando no hay salario", () => {
    assert.equal(formatSalary({ ...dummyJob, estimatedPay: null }, dummyPayFormat), "A convenir / No especificado");
  });
});

describe("formatJobItem", () => {
  it("escapa caracteres de Markdown en todos los campos, incluyendo la URL con guiones bajos", () => {
    const item = formatJobItem(dummyJob, dummyPayFormat, true);

    assert.match(item, /💼 \*Full Stack Engineer \\\*Pro\\\*\* - \*OpsBox\\_AI\*/);
    assert.match(item, /🌐 \*Portal:\* FreeHire/);
    assert.match(item, /📍 \*Ubicación:\* Remoto \\\[Argentina\\\]/);
    assert.match(item, /⭐ \*Score:\* 9\.5\/10/);
    assert.match(item, /💵 \*Pago estimado:\* ~\$25\.5 USD\/h/);
    assert.match(item, /💡 \*Por qué te conviene:\* Buen encaje con Node\\_js y React\\\*\./);
    assert.match(item, /🔗 https:\/\/torre\.ai\/post\/8wDaBZld-opsbox-ai-full-stack-engineer\?utm\\_source=freehire\.me&ref\\_id=1/);
  });

  it("omite la línea de score cuando showScore es falso", () => {
    const item = formatJobItem(dummyJob, dummyPayFormat, false);
    assert.doesNotMatch(item, /⭐ \*Score:\*/);
  });

  it("incluye la fecha de cierre escapada si está presente", () => {
    const item = formatJobItem({ ...dummyJob, closingDate: "30_11_2026" }, dummyPayFormat, false);
    assert.match(item, /📅 \*Cierre:\* 30\\_11\\_2026/);
  });
});

describe("formatJobsReportErrorMessage", () => {
  const originalEnv = { ...process.env };

  const restoreEnv = () => {
    process.env = { ...originalEnv };
  };

  it("arma el mensaje sin link si no corre en GitHub Actions", () => {
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_RUN_ID;

    const message = formatJobsReportErrorMessage("Alejandro", new Error("Conexión rechazada"));
    assert.equal(message, "⚠️ *Error en Daily Jobs Report (Alejandro):*\n```\nConexión rechazada\n```");
    restoreEnv();
  });

  it("incluye el link escapado a la corrida de GitHub Actions cuando está presente", () => {
    process.env.GITHUB_REPOSITORY = "Ale6100/cron-jobs";
    process.env.GITHUB_RUN_ID = "123456789";

    const message = formatJobsReportErrorMessage("Alejandro", new Error("Fallo de API"));
    assert.equal(
      message,
      "⚠️ *Error en Daily Jobs Report (Alejandro):*\n```\nFallo de API\n```\n🔗 https://github.com/Ale6100/cron-jobs/actions/runs/123456789"
    );
    restoreEnv();
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeMarkdown, formatPrice, getGitHubRunUrl } from "./util.js";

describe("formatPrice", () => {
  it("formatea en pesos argentinos con decimales", () => {
    assert.match(formatPrice(1234.5), /^\$\s1\.234,50$/);
  });

  it("puede omitir los decimales", () => {
    assert.match(formatPrice(1234.5, false), /^\$\s1\.235$/);
  });
});

describe("escapeMarkdown", () => {
  it("escapa caracteres especiales de formato Markdown", () => {
    assert.equal(escapeMarkdown("Puesto *Senior* _Full Stack_ `Node` [Arg]"), "Puesto \\*Senior\\* \\_Full Stack\\_ \\`Node\\` \\[Arg\\]");
  });

  it("escapa guiones bajos en URLs sin alterar el resto de la dirección", () => {
    const rawUrl = "https://torre.ai/post/8wDaBZld?utm_source=freehire.me&filter_tag=dev";
    assert.equal(escapeMarkdown(rawUrl), "https://torre.ai/post/8wDaBZld?utm\\_source=freehire.me&filter\\_tag=dev");
  });
});

describe("getGitHubRunUrl", () => {
  const originalEnv = { ...process.env };

  const restoreEnv = () => {
    process.env = { ...originalEnv };
  };

  it("devuelve null si no están las variables de GitHub Actions", () => {
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_RUN_ID;
    assert.equal(getGitHubRunUrl(), null);
    restoreEnv();
  });

  it("devuelve la URL completa con el servidor por defecto", () => {
    process.env.GITHUB_REPOSITORY = "Ale6100/cron-jobs";
    process.env.GITHUB_RUN_ID = "123456789";
    delete process.env.GITHUB_SERVER_URL;
    assert.equal(getGitHubRunUrl(), "https://github.com/Ale6100/cron-jobs/actions/runs/123456789");
    restoreEnv();
  });

  it("respeta un servidor personalizado de GitHub", () => {
    process.env.GITHUB_SERVER_URL = "https://github.enterprise.local";
    process.env.GITHUB_REPOSITORY = "Ale6100/cron-jobs";
    process.env.GITHUB_RUN_ID = "987654321";
    assert.equal(getGitHubRunUrl(), "https://github.enterprise.local/Ale6100/cron-jobs/actions/runs/987654321");
    restoreEnv();
  });
});

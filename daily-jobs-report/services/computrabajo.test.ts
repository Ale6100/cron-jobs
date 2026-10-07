import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { htmlResponse, mockFetch, silenceConsole } from "../../test-helpers/mockFetch.js";
import { extractOfferPaths, fetchComputrabajoJobs, parseJobPosting, pickPathsAcrossSearches } from "./computrabajo.js";

const OFFER_PATH = "/ofertas-de-trabajo/oferta-de-trabajo-de-cajero-en-palermo-294D8CE431328CEB";
const OFFER_URL = `https://ar.computrabajo.com${OFFER_PATH}`;

const buildListingHtml = (paths: string[]): string => paths
  .map((path, index) => `
    <article class="box_offer" data-id="${index}">
      <h2 class="fs18 fwB prB">
        <a class="js-o-link fc_base" href="${path}#lc=ListOffers-Score6-${index}">Oferta ${index}</a>
      </h2>
      <a class="fc_base t_ellipsis" href="https://ar.computrabajo.com/empresa">Empresa</a>
    </article>`)
  .join("\n");

const buildJobPosting = (overrides: Record<string, unknown> = {}) => ({
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  title: "Cajero/a",
  description: "Buscamos cajeros<br/>· Requisitos:\nSecundario completo. &amp; buena atención",
  datePosted: "2026-10-06",
  employmentType: "FULL_TIME",
  hiringOrganization: { "@type": "Organization", name: "ManpowerGroup" },
  jobLocation: { address: { addressLocality: "Capital Federal", addressRegion: "Palermo" } },
  baseSalary: { currency: "ARS", value: { value: 600000, unitText: "MONTH" } },
  ...overrides,
});

const buildDetailHtml = (posting: unknown): string => `
  <html><head>
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org/",
      "@graph": [{ "@type": "Organization", name: "Computrabajo Argentina" }, posting],
    })}</script>
  </head><body></body></html>`;

describe("extractOfferPaths", () => {
  it("extrae las rutas de las ofertas sin anclas ni parámetros y sin duplicados", () => {
    const html = `${buildListingHtml([OFFER_PATH, "/ofertas-de-trabajo/otra-oferta-ABC"])}
      <a href="${OFFER_PATH}?utm=x">repetida</a>`;

    assert.deepEqual(extractOfferPaths(html), [OFFER_PATH, "/ofertas-de-trabajo/otra-oferta-ABC"]);
  });
});

describe("pickPathsAcrossSearches", () => {
  it("alterna entre búsquedas, elimina duplicados y respeta el tope de 15", () => {
    const cajeraPaths = Array.from({ length: 20 }, (_, index) => `/cajera-${index}`);
    const vendedoraPaths = ["/cajera-0", ...Array.from({ length: 19 }, (_, index) => `/vendedora-${index}`)];

    const paths = pickPathsAcrossSearches([cajeraPaths, vendedoraPaths]);

    assert.equal(paths.length, 15);
    assert.deepEqual(paths.slice(0, 3), ["/cajera-0", "/cajera-1", "/vendedora-0"]);
  });
});

describe("parseJobPosting", () => {
  it("arma la oferta a partir del JSON-LD de la página de detalle", () => {
    assert.deepEqual(parseJobPosting(buildDetailHtml(buildJobPosting()), OFFER_URL), {
      id: "computrabajo-294D8CE431328CEB",
      title: "Cajero/a",
      company: "ManpowerGroup",
      location: "Palermo, Capital Federal",
      url: OFFER_URL,
      source: "Computrabajo",
      salary: "$600.000 ARS (MONTH)",
      publicationDate: "2026-10-06",
      tags: ["FULL_TIME"],
      snippet: "Buscamos cajeros · Requisitos: Secundario completo. & buena atención",
    });
  });

  it("informa el sueldo como no especificado cuando el portal lo publica en 0", () => {
    const posting = buildJobPosting({ baseSalary: { currency: "ARS", value: { value: 0, unitText: "MONTH" } } });
    assert.equal(parseJobPosting(buildDetailHtml(posting), OFFER_URL)?.salary, "No especificado");
  });

  it("devuelve null si la página no tiene un JobPosting válido", () => {
    const html = `<script type="application/ld+json">{ roto</script>${buildDetailHtml({ "@type": "WebPage" })}`;
    assert.equal(parseJobPosting(html, OFFER_URL), null);
  });
});

describe("fetchComputrabajoJobs", () => {
  beforeEach(silenceConsole);
  afterEach(() => mock.restoreAll());

  it("lee los listados y luego el detalle de cada oferta", async () => {
    mockFetch((url) => {
      if (url.includes("/trabajo-de-cajera-")) {
        return htmlResponse(buildListingHtml([OFFER_PATH]));
      }
      if (url.includes("/trabajo-de-")) {
        return htmlResponse("error", 500);
      }
      return htmlResponse(buildDetailHtml(buildJobPosting()));
    });

    const jobs = await fetchComputrabajoJobs();

    assert.deepEqual(jobs.map((job) => job.url), [OFFER_URL]);
  });

  it("omite las ofertas cuyo detalle no se pudo leer", async () => {
    const brokenPath = "/ofertas-de-trabajo/oferta-rota-XYZ";
    mockFetch((url) => {
      if (url.includes("/trabajo-de-")) return htmlResponse(buildListingHtml([OFFER_PATH, brokenPath]));
      if (url.endsWith(brokenPath)) return htmlResponse("error", 500);
      return htmlResponse(buildDetailHtml(buildJobPosting()));
    });

    const jobs = await fetchComputrabajoJobs();

    assert.deepEqual(jobs.map((job) => job.url), [OFFER_URL]);
  });

  it("falla si todas las búsquedas fallan", async () => {
    mockFetch(() => htmlResponse("error", 403));
    await assert.rejects(fetchComputrabajoJobs(), /Fallaron todas las búsquedas en Computrabajo/);
  });

  it("falla si hay ofertas pero ninguna se puede interpretar", async () => {
    mockFetch((url) => htmlResponse(url.includes("/trabajo-de-") ? buildListingHtml([OFFER_PATH]) : "<html></html>"));
    await assert.rejects(fetchComputrabajoJobs(), /No se pudo interpretar ninguna oferta/);
  });
});

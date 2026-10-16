import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { htmlResponse, mockFetch, silenceConsole } from "../../test-helpers/mockFetch.js";
import {
  fetchLinkedInJobs,
  parseJobCards,
  parseJobDetail,
  pickCardsAcrossQueries,
} from "./linkedin.js";

const buildSearchHtml = (items: Array<{ id: string; title: string; company?: string; location?: string; date?: string }>): string =>
  items
    .map(
      (item) => `
      <li>
        <div class="base-card" data-entity-urn="urn:li:jobPosting:${item.id}">
          <a class="base-card__full-link" href="https://ar.linkedin.com/jobs/view/puesto-${item.id}?trk=public_jobs">
            <span class="sr-only">${item.title}</span>
          </a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">${item.title}</h3>
            <h4 class="base-search-card__subtitle">
              <a>${item.company ?? "Comercio SA"}</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">${item.location ?? "Buenos Aires, Argentina"}</span>
              <time class="job-search-card__listdate" datetime="${item.date ?? "2026-10-15"}"></time>
            </div>
          </div>
        </div>
      </li>`
    )
    .join("\n");

const buildDetailHtml = (options: { description?: string; closed?: boolean; employmentType?: string } = {}): string => `
  <section class="top-card-layout">
    ${options.closed ? '<figure class="closed-job__flavor"><figcaption>No longer accepting applications</figcaption></figure>' : ""}
    <h1 class="top-card-layout__title">Puesto</h1>
  </section>
  <section class="description">
    <div class="show-more-less-html__markup">
      ${options.description ?? "<p>Atención al público &amp; manejo de caja.</p>"}
    </div>
    <ul class="description__job-criteria-list">
      <li>
        <h3 class="description__job-criteria-subheader">Employment type</h3>
        <span class="description__job-criteria-text">${options.employmentType ?? "Full-time"}</span>
      </li>
    </ul>
  </section>
`;

describe("parseJobCards", () => {
  it("extrae las tarjetas de ofertas limpiando parámetros de tracking y entidades HTML", () => {
    const cards = parseJobCards(
      buildSearchHtml([
        { id: "101", title: "Cajero/a &amp; Vendedor", company: "Tienda &#x2605;", location: "Capital Federal", date: "2026-10-16" },
      ])
    );

    assert.deepEqual(cards, [
      {
        id: "101",
        title: "Cajero/a & Vendedor",
        company: "Tienda ★",
        location: "Capital Federal",
        publicationDate: "2026-10-16",
        url: "https://ar.linkedin.com/jobs/view/puesto-101",
      },
    ]);
  });
});

describe("pickCardsAcrossQueries", () => {
  it("alterna entre búsquedas, aplica el filtro opcional, elimina duplicados y respeta el tope de 10", () => {
    const queryA = Array.from({ length: 8 }, (_, index) => ({
      id: `${100 + index}`,
      title: index === 0 ? "Senior React Developer" : `Vendedora ${index}`,
      company: "Empresa",
      location: "Buenos Aires",
      url: `https://www.linkedin.com/jobs/view/${100 + index}`,
    }));
    const queryB = [
      queryA[1]!,
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `${200 + index}`,
        title: `Cajera ${index}`,
        company: "Empresa",
        location: "Buenos Aires",
        url: `https://www.linkedin.com/jobs/view/${200 + index}`,
      })),
    ];

    const picked = pickCardsAcrossQueries([queryA, queryB], 10, (card) => !card.title.includes("Senior"));

    assert.equal(picked.length, 10);
    assert.equal(picked.some((card) => card.id === "100"), false);
    assert.deepEqual(picked.slice(0, 3).map((card) => card.id), ["101", "200", "102"]);
  });
});

describe("parseJobDetail", () => {
  const card = {
    id: "101",
    title: "Vendedora",
    company: "Local Ropa",
    location: "Caballito, CABA",
    publicationDate: "2026-10-15",
    url: "https://ar.linkedin.com/jobs/view/puesto-101",
  };

  it("arma la oferta limpia con la descripción y criterios del detalle", () => {
    assert.deepEqual(parseJobDetail(buildDetailHtml(), card), {
      id: "linkedin-101",
      title: "Vendedora",
      company: "Local Ropa",
      location: "Caballito, CABA",
      url: "https://ar.linkedin.com/jobs/view/puesto-101",
      source: "LinkedIn",
      salary: "No especificado",
      publicationDate: "2026-10-15",
      tags: ["Full-time"],
      snippet: "Atención al público & manejo de caja.",
    });
  });

  it("descarta ofertas cerradas en origen aunque sigan indexadas en la búsqueda", () => {
    assert.equal(parseJobDetail(buildDetailHtml({ closed: true }), card), null);
  });

  it("no confunde la frase de cierre si aparece dentro del texto del anuncio y no en el banner superior", () => {
    const job = parseJobDetail(
      buildDetailHtml({ description: "<p>Postulate antes de ver No longer accepting applications.</p>" }),
      card
    );
    assert.equal(job?.id, "linkedin-101");
  });
});

describe("fetchLinkedInJobs", () => {
  beforeEach(silenceConsole);
  afterEach(() => mock.restoreAll());

  it("consulta las búsquedas, ignora avisos cerrados y devuelve las ofertas activas", async () => {
    mockFetch((url) => {
      if (url.includes("/seeMoreJobPostings/search")) {
        return htmlResponse(
          buildSearchHtml([
            { id: "101", title: "Cajera" },
            { id: "102", title: "Vendedora" },
          ])
        );
      }
      if (url.endsWith("/101")) {
        return htmlResponse(buildDetailHtml({ closed: true }));
      }
      return htmlResponse(buildDetailHtml({ description: "<p>Ventas en salón</p>" }));
    });

    const jobs = await fetchLinkedInJobs([{ keywords: "cajera", location: "Buenos Aires" }]);

    assert.deepEqual(jobs.map((job) => job.id), ["linkedin-102"]);
  });

  it("falla si todas las búsquedas fallan", async () => {
    mockFetch(() => htmlResponse("forbidden", 403));
    await assert.rejects(
      fetchLinkedInJobs([{ keywords: "cajera", location: "Buenos Aires" }]),
      /Fallaron todas las búsquedas en LinkedIn/
    );
  });

  it("falla si hay ofertas abiertas pero ninguna se puede interpretar", async () => {
    mockFetch((url) =>
      htmlResponse(url.includes("/seeMoreJobPostings/search") ? buildSearchHtml([{ id: "101", title: "Cajera" }]) : "<html></html>")
    );

    await assert.rejects(
      fetchLinkedInJobs([{ keywords: "cajera", location: "Buenos Aires" }]),
      /No se pudo interpretar ninguna oferta de LinkedIn/
    );
  });
});

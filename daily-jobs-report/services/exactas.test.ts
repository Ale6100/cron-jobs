import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { htmlResponse, mockFetch, silenceConsole } from "../../test-helpers/mockFetch.js";
import { EXACTAS_OFFERS_URL, fetchExactasJobs, isStillOpen, parseClosingDate, parseExactasOffers } from "./exactas.js";

interface OfferFixture {
  number: string;
  career: string;
  position: string;
  closingDate: string;
}

const buildOfferHtml = ({ number, career, position, closingDate }: OfferFixture): string => `
<div class="su-spoiler su-spoiler-style-default su-spoiler-icon-plus su-spoiler-closed" data-scroll-offset="0" data-anchor-in-url="no"><div class="su-spoiler-title" tabindex="0" role="button"><span class="su-spoiler-icon"></span>Oferta #${number}: Estudiante (Avanzado) o Graduado/a en ${career} // Nombre del puesto: ${position}</div><div class="su-spoiler-content su-u-clearfix su-u-trim">
<div><strong>Perfil solicitado:</strong> Estudiante (nivel avanzado) o Graduado/a en ${career}.</div>
<div><strong>Cantidad de puestos a cubrir:</strong> 2</div>
<div><strong>Tipo de vínculo:</strong> Relación de dependencia</div>
<div><strong>Nombre del puesto:</strong> Puesto abreviado (Otra empresa)</div>
<p></p>
<div><strong>ACTIVIDAD PRINCIPAL / DESCRIPCIÓN DE TAREAS:</strong></div>
<ul style="margin-top: 5px;margin-bottom: 15px">
<li>Desarrollo de aplicaciones web &amp; APIs</li>
</ul>
<div><strong>Idiomas:</strong> Intermedio</div>
<div><strong>Zona de trabajo:</strong> CABA &#8211; Nuñez</div>
<div><strong>Horario estipulado:</strong> jornada completa</div>
<div><strong>Remuneración:</strong> A concertar</div>
<div><strong>Fecha de cierre:</strong> ${closingDate}</div>
<p></p>
<div style="background-color: #f5f5f5;padding: 15px;border-radius: 5px;border-left: 4px solid #0056b3">
<strong>&#x1f4e8; CÓMO POSTULARSE:</strong><br />
Quien se interese, debe enviar CV a: <a href="mailto:rrhh@empresa-ficticia.com">rrhh@empresa-ficticia.com</a><br />
<strong>Referencia:</strong> Persona Ficticia – Cargo: Contacto laboral
</div>
</div></div>`;

const buildPageHtml = (offers: OfferFixture[]): string => `
<html><body><article><div class="entry-content">
<p>Por consultas dirigirse a la casilla de la facultad</p>
<h1><b>Oferta</b></h1>
<p>${offers.map(buildOfferHtml).join("\n")}</p>
</div></article></body></html>`;

const DEVELOPER_OFFER: OfferFixture = {
  number: "102/26",
  career: "Ciencias de la Computación, Ciencia de Datos",
  position: "Desarrollador/a Jr. &#8211; Plataforma Web (Empresa Ficticia S.A. &#8211; área: Sistemas)",
  closingDate: "28/10/26",
};

const CLOSED_OFFER: OfferFixture = {
  number: "96/26",
  career: "Ciencias Químicas",
  position: "Analista de laboratorio (Laboratorio Ficticio)",
  closingDate: "23/09/26",
};

describe("parseExactasOffers", () => {
  it("arma cada oferta a partir de su bloque desplegable, con el puesto y la empresa del título", () => {
    const [offer] = parseExactasOffers(buildPageHtml([DEVELOPER_OFFER]));

    assert.deepEqual({ ...offer, snippet: undefined }, {
      id: "exactas-102/26",
      title: "#102/26 · Desarrollador/a Jr. – Plataforma Web",
      company: "Empresa Ficticia S.A.",
      location: "CABA – Nuñez",
      url: EXACTAS_OFFERS_URL,
      source: "Exactas UBA",
      salary: "A concertar",
      closingDate: "28/10/26",
      tags: ["Relación de dependencia", "jornada completa"],
      snippet: undefined,
    });
  });

  it("incluye en el resumen el perfil y las tareas, pero no los datos de contacto para postularse", () => {
    const [offer] = parseExactasOffers(buildPageHtml([DEVELOPER_OFFER]));

    assert.match(offer?.snippet ?? "", /Perfil solicitado: Estudiante \(nivel avanzado\) o Graduado\/a en Ciencias de la Computación/);
    assert.match(offer?.snippet ?? "", /Desarrollo de aplicaciones web & APIs/);
    assert.doesNotMatch(offer?.snippet ?? "", /rrhh@|Persona Ficticia|POSTULARSE/);
  });

  it("usa el puesto como título si no aclara la empresa entre paréntesis", () => {
    const [offer] = parseExactasOffers(buildPageHtml([{ ...DEVELOPER_OFFER, position: "Programador/a" }]));

    assert.equal(offer?.title, "#102/26 · Programador/a");
    assert.equal(offer?.company, "Empresa no especificada");
  });

  it("ignora bloques desplegables que no son ofertas numeradas", () => {
    const html = `<div class="su-spoiler su-spoiler-style-default"><div class="su-spoiler-title">Preguntas frecuentes</div></div>`;
    assert.deepEqual(parseExactasOffers(html), []);
  });
});

describe("parseClosingDate", () => {
  it("interpreta fechas dd/mm/aa y dd/mm/aaaa", () => {
    assert.deepEqual(parseClosingDate("14/10/26"), new Date(2026, 9, 14));
    assert.deepEqual(parseClosingDate("1/2/2027"), new Date(2027, 1, 1));
  });

  it("devuelve null si no hay una fecha reconocible", () => {
    assert.equal(parseClosingDate("Hasta cubrir el puesto"), null);
  });
});

describe("isStillOpen", () => {
  const [openOffer] = parseExactasOffers(buildPageHtml([DEVELOPER_OFFER]));

  it("considera abierta la oferta hasta el día de cierre inclusive, en hora de Argentina", () => {
    assert.equal(isStillOpen(openOffer!, new Date("2026-10-29T02:30:00Z")), true);
    assert.equal(isStillOpen(openOffer!, new Date("2026-10-29T03:01:00Z")), false);
  });

  it("no descarta ofertas sin fecha de cierre reconocible", () => {
    assert.equal(isStillOpen({ ...openOffer!, closingDate: "A definir" }, new Date(2030, 0, 1)), true);
  });
});

describe("fetchExactasJobs", () => {
  beforeEach(silenceConsole);
  afterEach(() => mock.restoreAll());

  it("devuelve solo las ofertas con la fecha de cierre sin vencer", async () => {
    mockFetch(() => htmlResponse(buildPageHtml([CLOSED_OFFER, DEVELOPER_OFFER])));

    const jobs = await fetchExactasJobs(new Date(2026, 9, 8));

    assert.deepEqual(jobs.map((job) => job.id), ["exactas-102/26"]);
  });

  it("falla si la página responde con error", async () => {
    mockFetch(() => htmlResponse("error", 503));
    await assert.rejects(fetchExactasJobs(), /Exactas UBA respondió 503/);
  });

  it("falla si la página no tiene ninguna oferta reconocible", async () => {
    mockFetch(() => htmlResponse("<html><body>Sitio en mantenimiento</body></html>"));
    await assert.rejects(fetchExactasJobs(), /es probable que haya cambiado su formato/);
  });
});

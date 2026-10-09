import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { jsonResponse, mockFetch, silenceConsole } from "../../test-helpers/mockFetch.js";
import { alejandroProfile, calculateYearsOfExperience } from "./alejandro.js";
import { alejandroExactasProfile } from "./alejandroExactas.js";
import { getProfileFromArgs } from "./index.js";
import { marianaProfile } from "./mariana.js";

describe("calculateYearsOfExperience", () => {
  it("cuenta años completos desde el inicio de carrera", () => {
    assert.equal(calculateYearsOfExperience(new Date(2026, 6, 2)), 3);
    assert.equal(calculateYearsOfExperience(new Date(2026, 5, 1)), 2);
  });

  it("nunca devuelve menos de 1 año", () => {
    assert.equal(calculateYearsOfExperience(new Date(2023, 8, 1)), 1);
  });
});

describe("alejandroProfile", () => {
  beforeEach(silenceConsole);
  afterEach(() => mock.restoreAll());

  it("muestra el pago por hora en USD con su equivalente en ARS según el dólar del día", async () => {
    mockFetch(() => jsonResponse({ venta: 1000 }));

    const payFormat = await alejandroProfile.loadPayFormat();

    assert.equal(payFormat.headerNote, "Dólar ref: $1000");
    assert.equal(payFormat.formatPay(25), "~$25 USD/h (*~$25.000 ARS/h*)");
  });
});

describe("marianaProfile", () => {
  it("muestra el pago como sueldo mensual en ARS, sin nota en el encabezado", async () => {
    const payFormat = await marianaProfile.loadPayFormat();

    assert.equal(payFormat.headerNote, undefined);
    assert.match(payFormat.formatPay(600000), /^~\$\s600\.000 ARS\/mes$/);
  });

  it("calcula la edad que usa Gemini a partir del año actual", async () => {
    const expectedAge = new Date().getFullYear() - 1995;
    const header = marianaProfile.buildGeminiPromptHeader(await marianaProfile.loadPayFormat());
    assert.match(header, new RegExp(`Edad aproximada: ${expectedAge} años`));
  });
});

describe("alejandroExactasProfile", () => {
  const payFormat = { usdToArsRate: 1500, formatPay: String };

  it("informa a Gemini las materias aprobadas y la carrera que deben pedir las ofertas", () => {
    const header = alejandroExactasProfile.buildGeminiPromptHeader(payFormat);

    assert.match(header, /Materias aprobadas: CBC completo, Álgebra 1, Introducción a la Programación, Análisis, Sistemas Digitales/);
    assert.match(header, /ACEPTAR solo si la oferta incluye Ciencias de la Computación/);
  });

  it("le pasa a Gemini la cotización para convertir sueldos en pesos a USD", () => {
    assert.match(alejandroExactasProfile.buildGeminiPromptHeader(payFormat), /\$1500 ARS por USD/);
    assert.match(alejandroExactasProfile.buildGeminiPromptHeader({ formatPay: String }), /no podés convertirlo a USD, devuelve null/);
  });

  it("no limita la cantidad de ofertas del reporte y recuerda las ya evaluadas", () => {
    assert.equal(alejandroExactasProfile.maxJobsInReport, Number.POSITIVE_INFINITY);
    assert.equal(alejandroExactasProfile.seenJobsStateFile, "alejandro-exactas.json");
  });
});

describe("getProfileFromArgs", () => {
  const originalArgv = process.argv;

  beforeEach(silenceConsole);
  afterEach(() => {
    process.argv = originalArgv;
    mock.restoreAll();
  });

  it("devuelve el perfil indicado por argumento", () => {
    process.argv = ["node", "index.ts", "mariana"];
    assert.equal(getProfileFromArgs(), marianaProfile);
  });

  it("termina el proceso si el perfil no existe", () => {
    process.argv = ["node", "index.ts", "desconocido"];
    mock.method(process, "exit", (code?: number) => {
      throw new Error(`exit ${code}`);
    });

    assert.throws(() => getProfileFromArgs(), /exit 1/);
  });
});

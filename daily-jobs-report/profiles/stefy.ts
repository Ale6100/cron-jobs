import { formatPrice } from "../../utils/util.js";
import { fetchBumeranJobs } from "../services/bumeran.js";
import { fetchComputrabajoJobs } from "../services/computrabajo.js";
import type { JobsReportProfile } from "../types.js";

export const BIRTH_DATE = new Date(1996, 9, 25);

const BUMERAN_QUERIES = [
  "vendedora",
  "cajera",
  "atención al cliente",
  "repositora",
  "promotora",
  "ayudante de cocina",
  "niñera",
  "cuidado de adultos mayores",
  "manicura",
];

const COMPUTRABAJO_SLUGS = [
  "vendedora",
  "cajera",
  "atencion-al-cliente",
  "repositor",
  "promotora",
  "ayudante-de-cocina",
  "ninera",
  "cuidado-de-adultos-mayores",
  "manicura",
];

export const calculateAge = (now = new Date()): number => {
  let age = now.getFullYear() - BIRTH_DATE.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > BIRTH_DATE.getMonth() ||
    (now.getMonth() === BIRTH_DATE.getMonth() && now.getDate() >= BIRTH_DATE.getDate());
  if (!hasHadBirthdayThisYear) {
    age--;
  }
  return age;
};

const buildGeminiPromptHeader = (): string => {
  const age = calculateAge();

  return `
Sos un recruiter experto en empleos de comercio, ventas, gastronomía, eventos, estética y cuidado de personas en Buenos Aires. Tu objetivo es evaluar las siguientes ofertas de trabajo y determinar cuáles son oportunidades REALMENTE viables y recomendables para la siguiente candidata.

### PERFIL DE LA CANDIDATA:
- Nombre: Stefany
- Edad: ${age} años
- Residencia: Lomas del Mirador, Buenos Aires (Gran Buenos Aires, Argentina)
- Idiomas: Español nativo. Sin inglés.
- Formación: Secundario completo. Curso de manicuría con certificado. Sin estudios terciarios ni universitarios.
- Experiencia laboral (15 años de trayectoria práctica, toda en empleos informales / no registrados en blanco):
  * Vendedora de ropa unisex, 02/2026 a la actualidad: atención y asesoramiento a clientes en el local, manejo de caja, cobros, reposición y exhibición de mercadería.
  * Vendedora de ropa interior, 03/2020 a 08/2025: atención y asesoramiento a clientas en talles y modelos, manejo de caja, control de stock y exhibición de productos.
  * Encargada y organizadora de eventos, 03/2019 a 11/2021: planificación y coordinación de eventos y del personal a cargo.
  * Ayudante de cocina, 03/2020 a 08/2020: cocina judía y coreana, preparación de ingredientes, armado de platos y orden.
  * Armadora de bijouterie, 03/2016 a 09/2018: armado de collares, pulseras y aros, control de terminaciones y embalaje de pedidos.
  * Promotora comercial y relevamiento de clientes, 04/2013 a 08/2015: promoción de productos y servicios, visita a comercios y relevamiento de datos de clientes.
  * Promotora (reparto de volantes), 04/2012 a 12/2013: reparto de volantes y promoción de comercios en la vía pública.
  * Niñera, 02/2011 a 05/2015: cuidado integral de niños (alimentación, higiene, juegos y acompañamiento escolar).
- Habilidades: atención al cliente, ventas y asesoramiento, manejo de caja y cobros, reposición y orden de mercadería, organización de eventos, cuidado de niños y adultos, comunicación oral y promoción comercial, manicuría.
- Disponibilidad: incorporación inmediata, Full-time o Part-time, presencial, híbrido o remoto.

### CRITERIOS DE EVALUACIÓN:
1. Rubros buscados: vendedora / comercio (especialmente indumentaria, lencería, accesorios y locales comerciales), cajera, atención al cliente (presencial o remota), repositora / control de stock / armado de pedidos, promotora comercial, organización o coordinación de eventos, ayudante de cocina / gastronomía, cuidado de niños (niñera) o de personas mayores, y manicuría.
   - DESCARTAR puestos administrativos o contables, de e-commerce o marketing digital, de gerencia o dirección corporativa, y cualquier rubro técnico o ajeno a los buscados.
2. Requisitos fuera de su alcance (DESCARTAR):
   - Título terciario o universitario, matrícula o certificación profesional habilitante (ej: enfermería, acompañante terapéutico matriculado, docente con título).
   - Inglés, conocimientos técnicos o de sistemas específicos como excluyentes (ej: Excel avanzado, sistemas de gestión puntuales), licencia de conducir o vehículo propio.
   - Rango de edad explícito que no incluya ${age} años.
3. Experiencia (amplia experiencia práctica y reciente en ventas/indumentaria y caja, pero ningún empleo fue registrado en blanco):
   - Su perfil es muy fuerte en ventas de salón (más de 6 años continuos y actuales en indumentaria), atención al cliente, caja y reposición/stock: PRIORIZAR estas ofertas.
   - Como todos sus empleos fueron informales (sin registrar), cumple pedidos de experiencia práctica, pero BAJAR el puntaje si la oferta exige explícitamente experiencia formal comprobable en ANSES o con recibos de sueldo.
   - En los demás rubros (gastronomía, eventos, armado de pedidos, promoción, niñera/cuidado de personas, manicuría), su experiencia es más acotada o menos reciente: descartar si exigen varios años de experiencia excluyente y reciente en ese puesto específico.
   - Si exige un curso o carnet corto que no tiene (ej: manipulación de alimentos, curso de cuidador domiciliario), no descartar, pero bajar el puntaje y mencionarlo en el motivo.
4. Ubicación y Modalidad:
   - Si la oferta es 100% REMOTA: Es válida siempre que admita trabajar desde Argentina.
   - Si la oferta es PRESENCIAL o HÍBRIDA: Solo válida si el lugar de trabajo es en CABA o alrededores (Gran Buenos Aires). Descartar otras ciudades o el interior de la provincia.
5. Sueldo mensual en ARS (estimatedPay):
   - Si la oferta indica un sueldo mensual en pesos, toma ese valor (o el promedio si es rango).
   - Si indica un valor por hora, por jornada o quincenal, conviértelo a mensual según la carga horaria indicada (si no la indica, asume jornada completa de 40 hs/semana, 160 hs/mes).
   - Si el sueldo no está especificado o es a convenir, devuelve null.
6. Score: Del 1 al 10. Solo marcar isMatch = true si el score es >= 7.
7. Motivo (reason): lo lee directamente Stefy. Escribilo en lenguaje simple y cercano, hablándole de vos, sin tecnicismos de recruiting ni menciones al score. Si la oferta pide algo que no tiene, mencionalo como dato útil (ej: "Piden curso de manipulación de alimentos").
`;
};

export const stefyProfile: JobsReportProfile = {
  firstName: "Stefy",
  telegramChatIdEnvVar: "TELEGRAM_CHAT_ID_STEFY_BUSQUEDA_TRABAJO",
  showScore: false,
  maxJobsInReport: 3,
  sources: [
    { name: "Bumeran", fetchJobs: () => fetchBumeranJobs(BUMERAN_QUERIES) },
    { name: "Computrabajo", fetchJobs: () => fetchComputrabajoJobs(COMPUTRABAJO_SLUGS) },
  ],
  buildGeminiPromptHeader,
  loadPayFormat: () => Promise.resolve({
    formatPay: (monthlyArs) => `~${formatPrice(monthlyArs, false)} ARS/mes`,
  }),
};

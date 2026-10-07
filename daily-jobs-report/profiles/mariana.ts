import { formatPrice } from "../../utils/util.js";
import { fetchBumeranJobs } from "../services/bumeran.js";
import { fetchComputrabajoJobs } from "../services/computrabajo.js";
import type { JobsReportProfile } from "../types.js";

const BIRTH_YEAR = 1995;

const buildGeminiPromptHeader = (): string => {
  const approximateAge = new Date().getFullYear() - BIRTH_YEAR;

  return `
Sos un recruiter experto en empleos de comercio, gastronomía y cuidado de personas en Buenos Aires. Tu objetivo es evaluar las siguientes ofertas de trabajo y determinar cuáles son oportunidades REALMENTE viables y recomendables para la siguiente candidata.

### PERFIL DE LA CANDIDATA:
- Nombre: Mariana
- Edad aproximada: ${approximateAge} años
- Residencia: Caballito, CABA (Buenos Aires, Argentina)
- Idiomas: Español nativo. Sin inglés.
- Formación: Secundario completo (Bachiller con orientación Físico-Matemático, 2017). Cursos cortos certificados por la Secretaría de Trabajo en 2025: "Introducción al comercio electrónico" y "Gestión de herramientas financieras para emprendedores". Sin estudios terciarios ni universitarios.
- Experiencia laboral:
  * Cadena de comidas rápidas, 05/2016 a 04/2019, ÚNICO empleo registrado (en blanco): atención al cliente y toma de pedidos en caja, manejo de caja y cobros (efectivo, tarjeta, medios electrónicos), preparación de alimentos con normas de higiene y calidad, limpieza y orden del área.
  * Tienda de ropa, 01/2015 a 03/2015, informal: venta y asesoramiento a clientes, reposición de mercadería, caja, control de stock, armado de vidrieras.
  * Asistente domiciliaria de personas mayores, informal: acompañamiento y cuidado diario, higiene personal, alimentación, movilidad, administración de medicamentos según indicación, preparación de comidas, compañía y control de rutinas.
  * Actual: pequeño emprendimiento propio e informal elaborando y vendiendo mini-donas.
- Habilidades: atención al cliente, manejo de caja, buena comunicación, trabajo en equipo, organización, proactividad.
- Disponibilidad: Full-time o Part-time, sin restricciones de horario.

### CRITERIOS DE EVALUACIÓN:
1. Rubros buscados: vendedora / comercio, cajera, repositora, atención al cliente (presencial o remota), ayudante de cocina / gastronomía y cuidado de personas mayores.
   - DESCARTAR puestos administrativos, de recepción, de e-commerce o marketing digital, de supervisión o jefatura, y cualquier rubro ajeno a los buscados.
2. Requisitos fuera de su alcance (DESCARTAR):
   - Título terciario o universitario, matrícula o certificación profesional (ej: enfermería, acompañante terapéutico matriculado).
   - Inglés, conocimientos técnicos o de sistemas específicos (ej: Excel avanzado, sistemas de gestión puntuales como excluyentes), licencia de conducir o vehículo propio.
   - Rango de edad explícito que no incluya ${approximateAge} años.
3. Experiencia (su experiencia formal es escasa y no reciente):
   - PRIORIZAR ofertas "sin experiencia", "primer empleo" o "con o sin experiencia".
   - Su experiencia registrada en caja, atención y comidas rápidas (3 años) cumple pedidos de experiencia general en esos puestos, pero terminó en 2019: BAJAR el puntaje si la oferta exige experiencia reciente, comprobable o con referencias laborales.
   - Su experiencia en venta de indumentaria y en cuidado de mayores fue informal: tenerla en cuenta como afinidad, pero BAJAR el puntaje si la oferta la exige comprobable.
   - DESCARTAR ofertas que exijan como excluyente más de 3 años de experiencia en el puesto.
   - Si exige un curso o carnet corto que no tiene (ej: manipulación de alimentos, curso de cuidador domiciliario), no descartar, pero bajar el puntaje y mencionarlo en el motivo.
4. Ubicación y Modalidad:
   - Si la oferta es 100% REMOTA: Es válida siempre que admita trabajar desde Argentina.
   - Si la oferta es PRESENCIAL o HÍBRIDA: Solo válida si el lugar de trabajo es en CABA o alrededores (Gran Buenos Aires). Descartar otras ciudades o el interior de la provincia.
5. Sueldo mensual en ARS (estimatedPay):
   - Si la oferta indica un sueldo mensual en pesos, toma ese valor (o el promedio si es rango).
   - Si indica un valor por hora, por jornada o quincenal, conviértelo a mensual según la carga horaria indicada (si no la indica, asume jornada completa de 40 hs/semana, 160 hs/mes).
   - Si el sueldo no está especificado o es a convenir, devuelve null.
6. Score: Del 1 al 10. Solo marcar isMatch = true si el score es >= 7.
7. Motivo (reason): lo lee directamente Mariana. Escribilo en lenguaje simple y cercano, hablándole de vos, sin tecnicismos de recruiting ni menciones al score. Si la oferta pide algo que no tiene, mencionalo como dato útil (ej: "Piden curso de manipulación de alimentos").
`;
};

export const marianaProfile: JobsReportProfile = {
  firstName: "Mariana",
  telegramChatIdEnvVar: "TELEGRAM_CHAT_ID_MARIANA",
  showScore: false,
  maxJobsInReport: 3,
  sources: [
    { name: "Bumeran", fetchJobs: fetchBumeranJobs },
    { name: "Computrabajo", fetchJobs: fetchComputrabajoJobs },
  ],
  buildGeminiPromptHeader,
  loadPayFormat: () => Promise.resolve({
    formatPay: (monthlyArs) => `~${formatPrice(monthlyArs, false)} ARS/mes`,
  }),
};

import { fetchExactasJobs } from "../services/exactas.js";
import type { JobsReportProfile, PayFormat } from "../types.js";
import {
  buildCandidateSection,
  buildSeniorityCriterion,
  getCandidateProfile,
  HOURLY_USD_PAY_CRITERION,
  LANGUAGE_CRITERION,
  loadHourlyUsdPayFormat,
  LOCATION_CRITERION,
  numberCriteria,
  SCORE_CRITERION,
} from "./alejandro.js";

export const STUDIES = {
  career: "Licenciatura en Ciencias de la Computación (Facultad de Ciencias Exactas y Naturales, UBA), plan 2023",
  approvedCourses: ["CBC completo", "Álgebra 1", "Introducción a la Programación", "Análisis", "Sistemas Digitales"],
  progress: "Primeros años de la carrera: CBC completo y 4 materias aprobadas de la carrera. NO es estudiante avanzado.",
};

const CAREER_CRITERION = `Carrera solicitada (campo "Perfil solicitado"):
   - ACEPTAR solo si la oferta incluye Ciencias de la Computación (o Computación) entre las carreras solicitadas, o si no especifica ninguna carrera.
   - DESCARTAR si pide exclusivamente otras carreras (ej: Ciencias Químicas, Biológicas, Físicas, Matemáticas o Ciencia de Datos), aunque el puesto parezca afín.`;

const PROGRESS_CRITERION = `Avance en la carrera:
   - Si la oferta pide estudiantes de cualquier nivel o de nivel inicial/intermedio, el avance no es un problema.
   - Si pide estudiante avanzado/a, no descartarla: su experiencia laboral real puede compensarlo, pero BAJAR el puntaje y mencionarlo en el motivo.
   - DESCARTAR si exige exclusivamente título de grado (solo graduados/as).`;

const ROLE_CRITERION = `Tipo de puesto:
   - ACEPTAR puestos de desarrollo de software (frontend, backend, full stack), integración de LLMs o automatización, y otros puestos técnicos de computación de nivel inicial donde su experiencia como desarrollador sea útil.
   - Valorar más los que coinciden con su stack (React, Next.js, TypeScript, NestJS, Node.js, Python).
   - DESCARTAR puestos sin relación con el desarrollo de software (ej: instalación de equipos, ventas, atención al público) o que exijan como excluyentes herramientas o conocimientos que no tiene (ej: SAP, SAS).`;

const EXACTAS_LANGUAGE_NOTE = `Nota sobre idiomas en estas ofertas: el campo "Idiomas" suele indicar solo un nivel, sin aclarar el idioma ni si es oral o escrito. Si pide nivel avanzado, no descartar automáticamente, pero bajar el puntaje y mencionarlo en el motivo.`;

const buildArsConversionNote = (payFormat: PayFormat): string => {
  return payFormat.usdToArsRate
    ? `   - Si el salario está en pesos argentinos (ARS), convertilo a USD con la cotización de referencia: $${payFormat.usdToArsRate} ARS por USD.`
    : "   - Si el salario está en pesos argentinos (ARS) y no podés convertirlo a USD, devuelve null.";
};

const buildGeminiPromptHeader = (payFormat: PayFormat): string => {
  const profile = getCandidateProfile();

  return `
Sos un recruiter técnico experto. Tu objetivo es evaluar las siguientes ofertas de trabajo publicadas por la Facultad de Ciencias Exactas y Naturales (UBA) para sus estudiantes, y determinar cuáles son oportunidades REALMENTE viables y recomendables para el siguiente candidato.

${buildCandidateSection(profile)}
- Estudios en curso: ${STUDIES.career}
- Materias aprobadas: ${STUDIES.approvedCourses.join(", ")}
- Avance: ${STUDIES.progress}

### CRITERIOS DE EVALUACIÓN:
${numberCriteria([
  CAREER_CRITERION,
  PROGRESS_CRITERION,
  ROLE_CRITERION,
  `${LANGUAGE_CRITERION}\n   - ${EXACTAS_LANGUAGE_NOTE}`,
  buildSeniorityCriterion(profile.maxAcceptableYearsOfExperience),
  LOCATION_CRITERION,
  `${HOURLY_USD_PAY_CRITERION}\n${buildArsConversionNote(payFormat)}`,
  SCORE_CRITERION,
])}
`;
};

export const alejandroExactasProfile: JobsReportProfile = {
  firstName: "Alejandro",
  telegramChatIdEnvVar: "TELEGRAM_CHAT_ID",
  showScore: true,
  maxJobsInReport: Number.POSITIVE_INFINITY,
  seenJobsStateFile: "alejandro-exactas.json",
  sources: [{ name: "Exactas UBA", fetchJobs: () => fetchExactasJobs() }],
  buildGeminiPromptHeader,
  loadPayFormat: loadHourlyUsdPayFormat,
};

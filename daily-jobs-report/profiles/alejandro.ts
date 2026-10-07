import { getDolarPrice } from "../services/dolar.js";
import { fetchGetOnBoardJobs } from "../services/getOnBoard.js";
import { fetchRemoteOkJobs } from "../services/remoteOk.js";
import { fetchRemotiveJobs } from "../services/remotive.js";
import type { JobsReportProfile } from "../types.js";

export interface CandidateProfile {
  name: string;
  role: string;
  currentYearsOfExperience: number;
  maxAcceptableYearsOfExperience: number;
  seniorityRange: string;
  languages: {
    spanish: string;
    english: string;
  };
  locationPreferences: {
    baseCity: string;
    remote: string;
    hybridOrOnsite: string;
  };
  technologies: {
    frontend: string[];
    backend: string[];
    aiAndLlms: string[];
    databases: string[];
    tools: string[];
  };
  highlights: string[];
  avoidKeywords: string[];
}

// Fecha de inicio de carrera tomada de portfolio/utils/experience.ts (07/2023, UNAHUR)
export const CAREER_START_DATE = new Date(2023, 6, 1);

export const calculateYearsOfExperience = (now = new Date()): number => {
  const diffMs = now.getTime() - CAREER_START_DATE.getTime();
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(1, Math.floor(years));
};

export const getCandidateProfile = (): CandidateProfile => {
  const currentYears = calculateYearsOfExperience();
  const maxAcceptableYears = currentYears + 2;

  return {
    name: "Alejandro Portaluppi",
    role: "Desarrollador Frontend & Full Stack",
    currentYearsOfExperience: currentYears,
    maxAcceptableYearsOfExperience: maxAcceptableYears,
    seniorityRange: "Desde Trainee / Pasante hasta Semi-Senior (Mid-level). No Senior ni liderazgo/gestión.",
    languages: {
      spanish: "Español (lengua materna / nativo)",
      english: "Lectura y comprensión escrita técnica buena. NO conversacional ni hablado fluido. DESCARTAR si el puesto exige inglés fluido/avanzado hablado ('fluent spoken English', 'conversational English', 'C1/C2').",
    },
    locationPreferences: {
      baseCity: "CABA y alrededores (Buenos Aires, Argentina)",
      remote: "Totalmente aceptado sin importar la ubicación de la empresa (local o internacional), siempre que permita trabajar remoto desde Argentina.",
      hybridOrOnsite: "Aceptado únicamente si la sede física es en CABA o alrededores. Descartar híbrido o presencial en otras ciudades o países.",
    },
    technologies: {
      frontend: ["React", "Next.js", "TypeScript", "JavaScript", "Tailwind CSS", "shadcn/ui", "Radix UI", "HTML5", "CSS3"],
      backend: ["NestJS", "Node.js", "Express", "Python", "Entity Framework", "PHP", "Yii 2", "REST APIs"],
      aiAndLlms: ["Integración de LLMs a herramientas y productos", "Tool Calling / Function Calling", "APIs de IA (Gemini, etc.)", "Prompt Engineering"],
      databases: ["PostgreSQL", "SQL Server", "MySQL", "MongoDB", "Firebase"],
      tools: ["Git", "GitHub", "GitLab", "Docker", "Vite", "Turbopack"],
    },
    highlights: [
      "Desarrollo frontend moderno con Next.js y React en producción (Virtualisa)",
      "Desarrollo full stack en proyectos gubernamentales de alta escala con NestJS, React y bases de datos relacionales (Ministerio de Defensa)",
      "Desarrollo web comunitario con PHP/Yii2 (UNAHUR)",
      "Desarrollo con Python e integración práctica de LLMs a herramientas y automatizaciones",
    ],
    avoidKeywords: [
      "Senior",
      "Sr",
      "Principal",
      "Staff",
      "Lead",
      "Tech Lead",
      "Architect",
      "Director",
      "VP",
      "Manager",
      "Fluent English",
      "Fluent spoken English",
      "Advanced English",
      "Conversational English",
      "C1",
      "C2",
    ],
  };
};

const buildEvaluationCriteria = (): string => {
  const profile = getCandidateProfile();

  return `
Sos un recruiter técnico experto. Tu objetivo es evaluar las siguientes ofertas de trabajo y determinar cuáles son oportunidades REALMENTE viables y recomendables para el siguiente candidato.

### PERFIL DEL CANDIDATO:
- Nombre: ${profile.name}
- Rol: ${profile.role}
- Idiomas:
  * Español: ${profile.languages.spanish}
  * Inglés: ${profile.languages.english}
- Años de experiencia actuales: ${profile.currentYearsOfExperience} años (calculados automáticamente desde su inicio en 2023)
- Máximo de años de experiencia aceptables en una oferta: ${profile.maxAcceptableYearsOfExperience} años (años actuales + 2 de tolerancia)
- Rango de seniority aceptable: ${profile.seniorityRange}
- Ubicación base y preferencias de modalidad:
  * Residencia: ${profile.locationPreferences.baseCity}
  * Modalidad Remota: ${profile.locationPreferences.remote}
  * Modalidad Híbrida / Presencial: ${profile.locationPreferences.hybridOrOnsite}
- Tecnologías Frontend: ${profile.technologies.frontend.join(", ")}
- Tecnologías Backend: ${profile.technologies.backend.join(", ")}
- Inteligencia Artificial y LLMs: ${profile.technologies.aiAndLlms.join(", ")}
- Bases de Datos: ${profile.technologies.databases.join(", ")}
- Experiencias clave: ${profile.highlights.join(" | ")}
- Términos y seniorities a DESCARTAR: ${profile.avoidKeywords.join(", ")}

### CRITERIOS DE EVALUACIÓN:
1. Tecnologías: Debe coincidir fuertemente con el stack del candidato (React, Next.js, TypeScript, NestJS, Fullstack, Node.js, Python, integración de herramientas con LLMs). Descartar roles de C++, Java clásico, Rust o tecnologías totalmente ajenas salvo que sea un rol frontend agnóstico.
2. Restricción Estricta de Idioma (Inglés):
   - El candidato es nativo en español. Comprende y lee inglés técnico con soltura, pero NO puede mantener conversaciones fluidas en inglés hablado.
   - DESCARTAR de inmediato ofertas que exijan inglés fluido, avanzado o conversacional para reuniones o llamadas (ej: "Fluent English required", "Fluent spoken English", "Strong verbal English", "C1/C2 English").
   - ACEPTAR ofertas en español, de empresas hispanohablantes/LATAM, o roles donde la comunicación sea asíncrona/escrita o el inglés requerido sea puramente técnico/lectura.
3. Seniority y Experiencia Dinámica:
   - ACEPTAR vacantes Trainee, Pasante / Intern, Junior y Semi-Senior (Mid-level).
   - DESCARTAR vacantes Senior, Staff, Principal, Lead, Tech Lead, Architect, Director o Manager.
   - DESCARTAR ofertas que exijan estrictamente más de ${profile.maxAcceptableYearsOfExperience} años de experiencia laboral.
4. Ubicación y Modalidad:
   - Si la oferta es 100% REMOTA: Es totalmente válida sin importar dónde esté radicada la empresa (CABA, interior o internacional), siempre que admita trabajar desde Argentina (Worldwide, Anywhere, Americas, LATAM o Argentina local).
   - Si la oferta es PRESENCIAL o HÍBRIDA: Solo válida si la sede física de trabajo es en CABA o alrededores (Buenos Aires, Argentina). Si es híbrida/presencial en otra ciudad o país, descartarla de inmediato.
5. Cálculo de Pago por Hora en USD (estimatedPay):
   - Extrae o calcula el valor por hora en USD considerando el régimen horario real de la oferta:
     * Si la oferta da una tarifa horaria explícita (ej: '$25/hr', '$30-40/h'), toma ese valor (o el promedio si es rango).
     * Si la oferta indica salario mensual o anual y su carga horaria semanal (ej: Part-time 20 hs/semana, Fractional 10-15 hs/semana, o Full-time), calcula el valor horario dividiendo el salario por las horas reales trabajadas (mensual / (hs_semanales * 4.33)).
     * Si es Full-time sin horas especificadas, asume la jornada estándar de 40 hs/semana (160 hs/mes).
     * Si el salario no está especificado o es a convenir, devuelve null.
6. Score: Del 1 al 10. Solo marcar isMatch = true si el score es >= 7.
`;
};

export const alejandroProfile: JobsReportProfile = {
  firstName: "Alejandro",
  telegramChatIdEnvVar: "TELEGRAM_CHAT_ID",
  showScore: true,
  maxJobsInReport: 1,
  sources: [
    { name: "Get on Board", fetchJobs: fetchGetOnBoardJobs },
    { name: "RemoteOK", fetchJobs: fetchRemoteOkJobs },
    { name: "Remotive", fetchJobs: fetchRemotiveJobs },
  ],
  buildEvaluationCriteria,
  loadPayFormat: async () => {
    const dolarRate = await getDolarPrice();
    console.log(`Cotización Dólar referencia: $${dolarRate} ARS`);

    return {
      headerNote: `Dólar ref: $${dolarRate}`,
      formatPay: (hourlyUsd) => {
        const hourlyArs = Math.round(hourlyUsd * dolarRate);
        return `~$${hourlyUsd} USD/h (*~$${hourlyArs.toLocaleString("es-AR")} ARS/h*)`;
      },
    };
  },
};

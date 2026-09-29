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

export const candidateProfile = getCandidateProfile();

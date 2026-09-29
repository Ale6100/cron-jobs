import { candidateProfile } from "../profile.js";
import type { CleanJob, JobSource } from "../types.js";

export interface JobMatch {
  id: string | number;
  title: string;
  company: string;
  url: string;
  location: string;
  source: JobSource;
  score: number;
  reason: string;
  estimatedHourlyUsd?: number | null;
}

interface GeminiEvaluationResponse {
  matches?: Array<{
    id: string | number;
    title: string;
    company: string;
    url: string;
    location?: string;
    score: number;
    reason: string;
    isMatch: boolean;
    estimatedHourlyUsd?: number | null;
  }>;
}

export const fetchAvailableGeminiModels = async (apiKey: string): Promise<string[]> => {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
      throw new Error(`Google API respondió ${res.status}`);
    }
    const data = (await res.json()) as {
      models?: Array<{
        name: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const extractVersion = (name: string): number => {
      const match = name.match(/gemini-(\d+(?:\.\d+)?)/);
      const versionStr = match?.[1];
      return versionStr ? parseFloat(versionStr) : 0;
    };

    const models = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter(
        (name) =>
          name.startsWith("gemini") &&
          !name.includes("tts") &&
          !name.includes("image") &&
          !name.includes("transcribe") &&
          !name.includes("clip") &&
          !name.includes("computer-use") &&
          !name.includes("customtools") &&
          !name.includes("robotics") &&
          extractVersion(name) >= 3.0
      )
      .sort((a, b) => {
        // Priorizar modelos Flash sobre Pro (por velocidad, costo y cuota gratuita)
        const isFlashA = a.includes("flash");
        const isFlashB = b.includes("flash");
        if (isFlashA !== isFlashB) return isFlashA ? -1 : 1;
        // Ordenar por versión descendente (ej: 3.8 > 3.7 > 3.6 > 3.5...)
        return extractVersion(b) - extractVersion(a);
      });

    if (models.length > 0) {
      return models;
    }
  } catch (error) {
    console.warn("Aviso: No se pudo obtener la lista dinámica de modelos de Gemini, usando modelos de respaldo:", error);
  }

  return ["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.8-flash"];
};

export const evaluateJobsWithGemini = async (
  jobs: CleanJob[],
  apiKey: string
): Promise<JobMatch[]> => {
  if (jobs.length === 0) {
    return [];
  }

  // Evaluamos hasta un máximo de 35 ofertas prefiltradas para balancear cobertura, tiempo y tokens
  const sampleJobs = jobs.slice(0, 35);

  const profile = candidateProfile;

  const prompt = `
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
5. Cálculo de Pago por Hora en USD (estimatedHourlyUsd):
   - Extrae o calcula el valor por hora en USD considerando el régimen horario real de la oferta:
     * Si la oferta da una tarifa horaria explícita (ej: '$25/hr', '$30-40/h'), toma ese valor (o el promedio si es rango).
     * Si la oferta indica salario mensual o anual y su carga horaria semanal (ej: Part-time 20 hs/semana, Fractional 10-15 hs/semana, o Full-time), calcula el valor horario dividiendo el salario por las horas reales trabajadas (mensual / (hs_semanales * 4.33)).
     * Si es Full-time sin horas especificadas, asume la jornada estándar de 40 hs/semana (160 hs/mes).
     * Si el salario no está especificado o es a convenir, devuelve null.
6. Score: Del 1 al 10. Solo marcar isMatch = true si el score es >= 7.

### OFERTAS A EVALUAR:
${JSON.stringify(sampleJobs, null, 2)}

Devuelve EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura:
{
  "matches": [
    {
      "id": 12345,
      "title": "Frontend Developer",
      "company": "Tech Corp",
      "url": "https://...",
      "location": "Worldwide",
      "score": 8,
      "reason": "Explicación concisa en español (1 o 2 oraciones) de por qué encaja.",
      "estimatedHourlyUsd": 25.0,
      "isMatch": true
    }
  ]
}
`;

  const candidateModels = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : await fetchAvailableGeminiModels(apiKey);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  // Reintentos rápidos por modelo (1s y 3s): si un modelo está saturado, conmutamos de inmediato al siguiente
  const RETRY_DELAYS_SEC = [1, 3];
  let lastError: Error | null = null;

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`Evaluando con modelo Gemini: ${model}...`);

    for (let attempt = 0; attempt <= RETRY_DELAYS_SEC.length; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        });

        if (response.status === 429) {
          const errorBody = await response.text();
          console.warn(`Límite de cuota (429) alcanzado en modelo ${model}. Probando siguiente modelo de respaldo...`);
          lastError = new Error(`Gemini 429 en ${model}: ${errorBody}`);
          break; // Salir del bucle de reintentos y pasar al siguiente modelo
        }

        if (response.status === 404) {
          const errorBody = await response.text();
          console.warn(`Modelo ${model} no disponible o discontinuado (404). Probando siguiente modelo...`);
          lastError = new Error(`Gemini 404 en ${model}: ${errorBody}`);
          break;
        }

        if (response.status === 503) {
          const errorBody = await response.text();
          const delay = RETRY_DELAYS_SEC[attempt];
          if (delay !== undefined) {
            console.warn(`Gemini (${model}) API respondió 503 (intento ${attempt + 1}/${RETRY_DELAYS_SEC.length + 1}). Reintentando en ${delay}s...`);
            await sleep(delay * 1000);
            continue;
          }
          console.warn(`Modelo ${model} no disponible tras múltiples reintentos por 503. Probando siguiente modelo de respaldo...`);
          lastError = new Error(`Gemini 503 en ${model}: ${errorBody}`);
          break; // Pasar al siguiente modelo
        }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API respondió ${response.status}: ${errorBody}`);
      }

      const rawJson = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const textContent = rawJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) {
        console.warn("Gemini no retornó contenido en la respuesta.");
        return [];
      }

      try {
        const parsed = JSON.parse(textContent) as GeminiEvaluationResponse;
        const matches = (parsed.matches || [])
          .filter((m) => m.isMatch && m.score >= 7)
          .sort((a, b) => b.score - a.score)
          .map((m) => {
            const originalJob = jobs.find((j) => String(j.id) === String(m.id));
            return {
              id: m.id,
              title: m.title,
              company: m.company,
              url: m.url || originalJob?.url || "",
              location: m.location || originalJob?.location || "Remoto",
              source: originalJob?.source || "Get on Board",
              score: m.score,
              reason: m.reason,
              estimatedHourlyUsd: typeof m.estimatedHourlyUsd === "number" ? m.estimatedHourlyUsd : null,
            };
          });

        return matches;
      } catch (error) {
        console.error("Error al parsear la respuesta JSON de Gemini:", error, textContent);
        return [];
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const delay = RETRY_DELAYS_SEC[attempt];
      if (delay !== undefined && !lastError.message.includes("Gemini API respondió 4")) {
        console.warn(`Error en petición a Gemini (${model}) (intento ${attempt + 1}/${RETRY_DELAYS_SEC.length + 1}): ${lastError.message}. Reintentando en ${delay}s...`);
        await sleep(delay * 1000);
        continue;
      }
      console.warn(`Modelo ${model} falló: ${lastError.message}. Intentando siguiente modelo...`);
      break;
    }
  }
}

  throw lastError || new Error("Error desconocido al consultar Gemini.");
};

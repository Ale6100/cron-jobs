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
  estimatedPay?: number | null;
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
    estimatedPay?: number | null;
  }>;
}

interface GoogleApiErrorBody {
  error?: {
    message?: string;
    details?: Array<{
      "@type"?: string;
      retryDelay?: string;
      violations?: Array<{ quotaId?: string; quotaValue?: string }>;
    }>;
  };
}

export const describeQuotaError = (errorBody: string): string => {
  let parsed: GoogleApiErrorBody;
  try {
    parsed = JSON.parse(errorBody) as GoogleApiErrorBody;
  } catch {
    return errorBody.slice(0, 300);
  }

  const details = parsed.error?.details ?? [];
  const violations = details
    .flatMap((detail) => detail.violations ?? [])
    .map((violation) => `${violation.quotaId ?? "cuota desconocida"}${violation.quotaValue ? ` = ${violation.quotaValue}` : ""}`);
  const retryDelay = details.find((detail) => detail.retryDelay)?.retryDelay;

  const summary = violations.length > 0 ? violations.join(", ") : parsed.error?.message?.slice(0, 300) ?? "sin detalle";
  return retryDelay ? `${summary}; reintentar en ${retryDelay}` : summary;
};

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
        const fullFlashFirst = Number(a.includes("lite")) - Number(b.includes("lite"));
        if (fullFlashFirst !== 0) return fullFlashFirst;
        // Ordenar por versión descendente (ej: 3.8 > 3.7 > 3.6 > 3.5...)
        const newestVersionFirst = extractVersion(b) - extractVersion(a);
        if (newestVersionFirst !== 0) return newestVersionFirst;
        const stableBeforePreview = Number(a.includes("preview")) - Number(b.includes("preview"));
        return stableBeforePreview;
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
  promptHeader: string,
  apiKey: string
): Promise<JobMatch[]> => {
  if (jobs.length === 0) {
    return [];
  }

  // Evaluamos hasta un máximo de 35 ofertas prefiltradas para balancear cobertura, tiempo y tokens
  const sampleJobs = jobs.slice(0, 35);

  const prompt = `
${promptHeader}
### OFERTAS A EVALUAR:
${JSON.stringify(sampleJobs, null, 2)}

Devuelve EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura:
{
  "matches": [
    {
      "id": 12345,
      "title": "Título del puesto",
      "company": "Empresa",
      "url": "https://...",
      "location": "Ubicación",
      "score": 8,
      "reason": "Explicación concisa en español (1 o 2 oraciones) de por qué encaja.",
      "estimatedPay": 25.0,
      "isMatch": true
    }
  ]
}
`;

  const candidateModels = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : await fetchAvailableGeminiModels(apiKey);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  // Secuencia Fibonacci extendida (>6 minutos en total, 12 intentos) para dar suficiente tiempo de recuperación ante picos de demanda
  const RETRY_DELAYS_SEC = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
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
          console.warn(`Límite de cuota (429) alcanzado en modelo ${model} (${describeQuotaError(errorBody)}). Probando siguiente modelo de respaldo...`);
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
          .flatMap((m) => {
            const originalJob = sampleJobs.find((j) => String(j.id) === String(m.id));
            if (!originalJob) {
              console.warn(`Gemini devolvió una oferta con id inexistente (${m.id}), se descarta.`);
              return [];
            }
            return [{
              id: m.id,
              title: m.title,
              company: m.company,
              url: m.url || originalJob.url,
              location: m.location || originalJob.location,
              source: originalJob.source,
              score: m.score,
              reason: m.reason,
              estimatedPay: typeof m.estimatedPay === "number" ? m.estimatedPay : null,
            }];
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

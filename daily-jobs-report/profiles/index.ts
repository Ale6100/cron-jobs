import type { JobsReportProfile } from "../types.js";
import { alejandroProfile } from "./alejandro.js";
import { alejandroExactasProfile } from "./alejandroExactas.js";
import { marianaProfile } from "./mariana.js";

const PROFILES: Record<string, JobsReportProfile> = {
  alejandro: alejandroProfile,
  "alejandro-exactas": alejandroExactasProfile,
  mariana: marianaProfile,
};

export const getProfileFromArgs = (): JobsReportProfile => {
  const profileKey = process.argv[2] ?? "";
  const profile = PROFILES[profileKey];

  if (!profile) {
    console.error(`Perfil inválido: "${profileKey}". Indicá uno de: ${Object.keys(PROFILES).join(", ")} (ej: npm run daily-jobs-report -- mariana)`);
    process.exit(1);
  }

  return profile;
};

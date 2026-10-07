import { getProfileFromArgs } from "./profiles/index.js";

const profile = getProfileFromArgs();

const runTest = async () => {
  const sourceNames = profile.sources.map((source) => source.name);
  console.log(`Ejecutando test multi-fuente para ${profile.firstName} (${sourceNames.join(", ")})...`);

  const settledResults = await Promise.allSettled(profile.sources.map((source) => source.fetchJobs()));
  const jobsBySource = settledResults.map((result) => (result.status === "fulfilled" ? result.value : []));

  console.log(`\nResultados por fuente:`);
  profile.sources.forEach((source, index) => {
    console.log(`- ${source.name}: ${jobsBySource[index]?.length ?? 0} ofertas prefiltradas`);
  });

  const all = jobsBySource.flat();
  console.log(`\nTotal consolidado: ${all.length} ofertas preliminares.`);

  if (all.length > 0) {
    console.log("\nMuestra de las primeras 5 ofertas consolidadas:");
    all.slice(0, 5).forEach((job, index) => {
      console.log(`${index + 1}. [${job.source} | ${job.company}] ${job.title}`);
      console.log(`   Ubicación: ${job.location}`);
      console.log(`   Link: ${job.url}`);
    });
  }
};

runTest().catch((err) => {
  console.error("Error en test:", err);
  process.exit(1);
});

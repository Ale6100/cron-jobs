import { fetchGetOnBoardJobs } from "./services/getOnBoard.js";
import { fetchRemoteOkJobs } from "./services/remoteOk.js";
import { fetchRemotiveJobs } from "./services/remotive.js";

const runTest = async () => {
  console.log("Ejecutando test multi-fuente (Get on Board, RemoteOK, Remotive)...");

  const [getOnBrdRes, remoteOkRes, remotiveRes] = await Promise.allSettled([
    fetchGetOnBoardJobs(),
    fetchRemoteOkJobs(),
    fetchRemotiveJobs(),
  ]);

  const getOnBoardJobs = getOnBrdRes.status === "fulfilled" ? getOnBrdRes.value : [];
  const remoteOkJobs = remoteOkRes.status === "fulfilled" ? remoteOkRes.value : [];
  const remotiveJobs = remotiveRes.status === "fulfilled" ? remotiveRes.value : [];

  console.log(`\nResultados por fuente:`);
  console.log(`- Get on Board: ${getOnBoardJobs.length} ofertas prefiltradas`);
  console.log(`- RemoteOK:     ${remoteOkJobs.length} ofertas prefiltradas`);
  console.log(`- Remotive:     ${remotiveJobs.length} ofertas prefiltradas`);

  const all = [...getOnBoardJobs, ...remoteOkJobs, ...remotiveJobs];
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

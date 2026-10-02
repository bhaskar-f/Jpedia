const { env, validateEnv } = require("./config/env");
const { connectDatabase } = require("./config/database");
const app = require("./app");
const { startSchedulers } = require("./jobs/scheduler");
async function start() {
  let stage = "environment_validation";
  try {
    validateEnv();
    stage = "database_connection";
    await connectDatabase(env.mongoUri);
    stage = "atlas_search_initialization";
    await require("./config/atlasSearch").ensureJobSearchIndex();
    stage = "http_server_start";
  startSchedulers();
  const server = app.listen(env.port, () =>
    console.info(`SetBGet API listening on port ${env.port} (${env.nodeEnv})`),
  );
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${env.port} is already in use. Stop the other SetBGet server or set PORT to a free port before starting this one.`,
      );
      process.exit(1);
    }
    console.error({ event: "server_error", errorType: error.name || "Error", code: error.code });
    process.exit(1);
  });
  const shutdown = (signal) => {
    console.info(`${signal} received; shutting down.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    const message = stage === "environment_validation"
      ? error.message
      : stage === "database_connection"
        ? "MongoDB connection failed; check the configured database and Atlas network access."
        : "API initialization failed; check the backend configuration and service logs.";
    console.error({ event: "startup_failure", stage, errorType: error.name || "Error", code: error.code, message });
    process.exit(1);
  }
}
start().catch(() => {
  console.error({ event: "startup_failure", stage: "unexpected", message: "Unexpected API startup failure." });
  process.exit(1);
});

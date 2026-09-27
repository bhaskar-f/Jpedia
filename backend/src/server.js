const { env, validateEnv } = require("./config/env");
const { connectDatabase } = require("./config/database");
const app = require("./app");
const { startSchedulers } = require("./jobs/scheduler");
async function start() {
  validateEnv();
  await connectDatabase(env.mongoUri);
  require("./config/atlasSearch").ensureJobSearchIndex();
  startSchedulers();
  const server = app.listen(env.port, () =>
    console.info(`j-info API listening on port ${env.port} (${env.nodeEnv})`),
  );
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${env.port} is already in use. Stop the other J-Info server or set PORT to a free port before starting this one.`,
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
}
start().catch((error) => {
  console.error({ event: "startup_failure", errorType: error.name || "Error", code: error.code });
  process.exit(1);
});

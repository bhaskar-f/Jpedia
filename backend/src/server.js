const { env, validateEnv } = require("./config/env");
const { connectDatabase } = require("./config/database");
const app = require("./app");
const { startSchedulers } = require("./jobs/scheduler");
const http = require("node:http");
const mongoose = require("mongoose");

const role = process.env.RAILWAY_SERVICE_ROLE || "web";

async function start() {
  let stage = "environment_validation";
  try {
    validateEnv();
    stage = "database_connection";
    await connectDatabase(env.mongoUri);
    stage = "atlas_search_initialization";
    await require("./config/atlasSearch").ensureJobSearchIndex();
    if (role === "worker") {
      stage = "scheduler_start";
      startSchedulers();
      const server = http.createServer((req, res) => {
        const isReadyPath = req.method === "GET" && req.url === "/api/ready";
        const ready = isReadyPath && mongoose.connection.readyState === 1;
        res.writeHead(ready ? 200 : isReadyPath ? 503 : 404, { "content-type": "application/json" });
        res.end(JSON.stringify(ready
          ? { success: true, data: { status: "ok", timestamp: new Date().toISOString() } }
          : { success: false, error: { code: "NOT_READY", message: "Worker is not ready." } }));
      });
      server.listen(env.port, () => console.info(`SetBGet background worker ready on port ${env.port}.`));
      server.on("error", (error) => {
        console.error({ event: "worker_server_error", errorType: error.name || "Error", code: error.code });
        process.exit(1);
      });
      return;
    }
    if (role !== "web") throw new Error("RAILWAY_SERVICE_ROLE must be web or worker.");
    if (!process.env.RAILWAY_SERVICE_ROLE) startSchedulers();
    stage = "http_server_start";
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
        ? "MongoDB connection failed; verify MONGODB_URI and database network access."
        : "API initialization failed; check the backend configuration and service logs.";
    console.error({ event: "startup_failure", stage, errorType: error.name || "Error", code: error.code, message });
    process.exit(1);
  }
}
start().catch(() => {
  console.error({ event: "startup_failure", stage: "unexpected", message: "Unexpected API startup failure." });
  process.exit(1);
});

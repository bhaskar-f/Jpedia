const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit").rateLimit;
const { MongoRateLimitStore } = require("./middleware/mongo-rate-limit.store");
const passport = require("passport");
const { env } = require("./config/env");
const mongoSanitize = require("express-mongo-sanitize");
const { validate } = require("./middleware/validate.middleware");
const { z } = require("zod");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const jobRoutes = require("./routes/job.routes");
const boardRoutes = require("./routes/board.routes");
const accountRoutes = require("./routes/account.routes");
const communities = require("./routes/community.routes");
const resourceRoutes = require("./routes/resource.routes");
const adminRoutes = require("./routes/admin.routes");
const authorAssetRoutes = require("./routes/authorAsset.routes");
const contentRoutes = require("./routes/content.routes");
const cronRoutes = require("./routes/cron.routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");
const { asyncHandler, success } = require("./utils/http");
const { requireAuth } = require("./middleware/auth.middleware");
const healthController = require("./controllers/health.controller");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'https:'], frameSrc: ["'self'", 'https://www.youtube.com'] } } }));
const { createCorsOptions } = require("./config/cors");
app.use(cors(createCorsOptions(env.clientOrigins)));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(mongoSanitize());
app.use(cookieParser());
app.use(passport.initialize());
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 180,
    store: new MongoRateLimitStore('api'),
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.get("/api/health", healthController.health);
app.use("/api/cron", cronRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api", accountRoutes);
app.use("/api/communities", communities);
app.use("/api/posts", communities.postRouter());
app.use("/api/comments", communities.commentRouter());
app.use("/api/resources", resourceRoutes);
app.use("/api/author", authorAssetRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", contentRoutes);
app.post(
  "/api/notifications/global",
  requireAuth,
  require("./middleware/role.middleware").adminOnly,
  validate(
    z
      .object({
        type: z.string().min(2).max(80).optional(),
        title: z.string().min(2).max(200),
        message: z.string().max(2000).optional(),
        relatedJob: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .optional(),
        relatedBoard: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .optional(),
      })
      .strict(),
  ),
  asyncHandler(require("./controllers/account.controller").createGlobal),
);
// Keep the legacy/local combined experience available. Vercel's API project
// sets VERCEL=1 and never serves frontend files.
if (process.env.VERCEL !== "1") {
  const frontendRoot = path.resolve(__dirname, "../../frontend");
  app.use(express.static(frontendRoot, { index: false }));
  app.get(["/", "/index.html", /^\/(?:admin|dashboard|jobs|boards|communities|services)(?:\/.*)?$/, "/profile", "/settings", "/notifications", "/faqs", "/privacy", "/terms", "/about", "/contact"], (req, res) => res.sendFile(path.join(frontendRoot, "index.html")));
  app.get("/data.json", (req, res) => res.sendFile(path.join(__dirname, "data", "seed.json")));
  for (const file of ["qualification-taxonomy.json", "job-taxonomy.json", "india-locations.json"])
    app.get(`/data/${file}`, (req, res) => res.sendFile(path.join(__dirname, "data", file)));
}
app.use(notFound);
app.use(errorHandler);
module.exports = app;

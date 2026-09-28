const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit").rateLimit;
const passport = require("passport");
const path = require("path");
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
const { notFound, errorHandler } = require("./middleware/error.middleware");
const { asyncHandler, success } = require("./utils/http");
const { requireAuth } = require("./middleware/auth.middleware");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'https:'], frameSrc: ["'self'", 'https://www.youtube.com'] } } }));
app.use(
  cors({
    origin: env.clientOrigin.split(",").map((x) => x.trim()),
    credentials: true,
  }),
);
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
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.get("/api/health", (req, res) =>
  success(res, { status: "ok", timestamp: new Date().toISOString() }),
);
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
const frontendRoot = path.resolve(__dirname, "../..");
app.get(["/", "/index.html"], (req, res) =>
  res.sendFile(path.join(frontendRoot, "index.html")),
);
app.get(/^\/admin(?:\/.*)?$/, (req, res) =>
  res.sendFile(path.join(frontendRoot, "index.html")),
);
app.get(
  ["/jobs", "/communities", "/notifications", "/faqs", "/dashboard", "/boards", "/profile", "/settings", "/privacy", "/terms", "/about", "/contact"],
  (req, res) => res.sendFile(path.join(frontendRoot, "index.html")),
);
app.get(/^\/dashboard\/.*$/, (req, res) => res.sendFile(path.join(frontendRoot, "index.html")));
app.get(/^\/services(?:\/.*)?$/, (req, res) =>
  res.sendFile(path.join(frontendRoot, "index.html")),
);
app.get(/^\/(?:jobs|boards|communities)\/[^/]+$/, (req, res) =>
  res.sendFile(path.join(frontendRoot, "index.html")),
);
for (const file of [
  "style.css",
  "script.js",
  "admin.js",
  "public-pages.js",
  "job-details.js",
  "board-details.js",
  "job-content.js",
  "youtube-video.js",
  "data.json",
  "logo.png",
  "favicon.png"
])
  app.get(`/${file}`, (req, res) =>
    res.sendFile(path.join(frontendRoot, file)),
  );
for (const file of ["qualification-taxonomy.json", "job-taxonomy.json", "india-locations.json"])
  app.get(`/data/${file}`, (req, res) => res.sendFile(path.join(__dirname, "data", file)));
app.use(notFound);
app.use(errorHandler);
module.exports = app;

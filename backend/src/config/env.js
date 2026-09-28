const dotenv = require("dotenv");
dotenv.config();
const accessTtl = process.env.ACCESS_TOKEN_TTL || "15m";
const accessTtlMatch = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)$/i.exec(accessTtl);
const accessTtlMs = accessTtlMatch
  ? Number(accessTtlMatch[1]) *
    {
      ms: 1,
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
      w: 604800000,
      y: 31536000000,
    }[accessTtlMatch[2].toLowerCase()]
  : 0;
const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/jinfo",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5500",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "",
  accessTtl,
  accessTtlMs,
  refreshDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  cookieSecure:
    process.env.COOKIE_SECURE === "true" ||
    (process.env.COOKIE_SECURE !== "false" &&
      (process.env.NODE_ENV || "development") === "production"),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "",
  twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioVerifySid: process.env.TWILIO_VERIFY_SERVICE_SID || "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || "",
  cloudinaryName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinarySecret: process.env.CLOUDINARY_API_SECRET || "",
  emailHost: process.env.EMAIL_HOST || "",
  emailPort: Number(process.env.EMAIL_PORT || 587),
  emailSecure: process.env.EMAIL_SECURE === "true",
  emailUser: process.env.EMAIL_USER || "",
  emailPassword: process.env.EMAIL_PASSWORD || "",
  emailFrom: process.env.EMAIL_FROM || "",
  recruitmentCron: process.env.RECRUITMENT_CRON || "0 3 * * *",
};
function validateEnv() {
  if (!env.jwtSecret || !env.jwtRefreshSecret)
    throw new Error(
      "Set JWT_SECRET and JWT_REFRESH_SECRET in .env before starting the API.",
    );
  if (
    env.nodeEnv === "production" &&
    (env.jwtSecret.length < 32 ||
      env.jwtRefreshSecret.length < 32 ||
      /replace|example|change-me/i.test(env.jwtSecret + env.jwtRefreshSecret))
  )
    throw new Error(
      "Set two distinct random JWT secrets of at least 32 characters in production; example placeholders are not accepted.",
    );
  if (
    env.jwtSecret &&
    env.jwtRefreshSecret &&
    env.jwtSecret === env.jwtRefreshSecret
  )
    throw new Error("JWT secrets must be distinct.");
  if (env.nodeEnv === "production" && !process.env.CLIENT_ORIGIN)
    throw new Error("Set CLIENT_ORIGIN explicitly in production.");
  if (env.nodeEnv === "production" && !process.env.MONGODB_URI)
    throw new Error("Set MONGODB_URI explicitly in production.");
  if (env.nodeEnv === "production" && !env.cookieSecure)
    throw new Error(
      "Set COOKIE_SECURE=true in production so authentication cookies are sent only over HTTPS.",
    );
  if (
    !Number.isInteger(env.emailPort) ||
    env.emailPort < 1 ||
    env.emailPort > 65535
  )
    throw new Error("EMAIL_PORT must be a valid TCP port.");
  if (!env.accessTtlMs)
    throw new Error(
      "ACCESS_TOKEN_TTL must be a positive duration such as 15m or 1h.",
    );
}
module.exports = { env, validateEnv };

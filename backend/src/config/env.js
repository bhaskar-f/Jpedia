const dotenv = require("dotenv");
const path = require("node:path");
if (process.env.VERCEL !== "1") {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}
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
  clientOrigin: (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "http://localhost:5500").split(",").map(value => value.trim()).filter(Boolean)[0] || "http://localhost:5500",
  clientOrigins: (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "http://localhost:5500").split(",").map(value => value.trim()).filter(Boolean),
  cookieSameSite: (process.env.COOKIE_SAME_SITE || ((process.env.NODE_ENV || "development") === "production" ? "none" : "lax")).toLowerCase(),
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
  cronSecret: process.env.CRON_SECRET || "",
};
function isPlaceholder(value) {
  return /(?:YOUR[_ -]|REPLACE|EXAMPLE|CHANGE[_ -]?ME|PLACEHOLDER|^<[^>]+>$)/i.test(value);
}
function validateHttpsUrl(value, label, { originOnly = false } = {}) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be a valid HTTPS URL.`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (originOnly && (parsed.pathname !== '/' || parsed.search || parsed.hash)))
    throw new Error(`${label} must be a valid HTTPS ${originOnly ? 'origin' : 'URL'}.`);
}
function validateEnv() {
  if (!env.jwtSecret || !env.jwtRefreshSecret)
    throw new Error(
      "Set JWT_SECRET and JWT_REFRESH_SECRET in .env before starting the API.",
    );
  if (env.nodeEnv === "production" && [env.jwtSecret, env.jwtRefreshSecret].some(secret => secret.length < 32 || isPlaceholder(secret)))
    throw new Error("Set two distinct random JWT secrets of at least 32 characters in production; placeholder values are not accepted.");
  if (
    env.jwtSecret &&
    env.jwtRefreshSecret &&
    env.jwtSecret === env.jwtRefreshSecret
  )
    throw new Error("JWT secrets must be distinct.");
  if (env.nodeEnv === "production" && !process.env.CLIENT_ORIGIN && !process.env.CLIENT_ORIGINS)
    throw new Error("Set CLIENT_ORIGINS explicitly in production.");
  if (env.nodeEnv === "production") {
    const origins = env.clientOrigins;
    if (origins.some(isPlaceholder)) throw new Error("Replace CLIENT_ORIGIN with the deployed HTTPS origin.");
    origins.forEach(origin => validateHttpsUrl(origin, "CLIENT_ORIGIN", { originOnly: true }));
    if (!process.env.COOKIE_SECURE || process.env.COOKIE_SECURE.toLowerCase() !== "true")
      throw new Error("Set COOKIE_SECURE=true in production.");
    if (!process.env.MONGODB_URI || isPlaceholder(process.env.MONGODB_URI) || !/^mongodb(?:\+srv)?:\/\//i.test(env.mongoUri))
      throw new Error("Set MONGODB_URI to a valid MongoDB connection string in production.");
    if (env.googleClientId && !env.googleClientSecret || env.googleClientSecret && !env.googleClientId)
      throw new Error("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or leave both unset to disable Google login.");
    if (!env.googleClientId || !env.googleClientSecret || !env.googleCallbackUrl)
      throw new Error("Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL in production.");
    if (isPlaceholder(env.googleClientId) || isPlaceholder(env.googleClientSecret))
      throw new Error("Replace Google OAuth placeholder values in production.");
    validateHttpsUrl(env.googleCallbackUrl, "GOOGLE_CALLBACK_URL");
    const callback = new URL(env.googleCallbackUrl);
    if (callback.pathname !== '/api/auth/google/callback' || callback.search || callback.hash)
      throw new Error("GOOGLE_CALLBACK_URL must end in /api/auth/google/callback on the backend origin.");
    if (!['none', 'lax', 'strict'].includes(env.cookieSameSite) || env.cookieSameSite === 'none' && !env.cookieSecure)
      throw new Error("COOKIE_SAME_SITE must be none, lax, or strict; none requires COOKIE_SECURE=true.");
    for (const [label, value] of [["EMAIL_HOST", env.emailHost], ["EMAIL_USER", env.emailUser], ["EMAIL_PASSWORD", env.emailPassword], ["EMAIL_FROM", env.emailFrom]])
      if (!value || isPlaceholder(value)) throw new Error(`Set ${label} in production; email verification and password recovery require SMTP.`);
    if (!Number.isInteger(env.emailPort) || env.emailPort < 1 || env.emailPort > 65535)
      throw new Error("EMAIL_PORT must be a valid TCP port.");
    for (const [label, value] of [["CLOUDINARY_CLOUD_NAME", env.cloudinaryName], ["CLOUDINARY_API_KEY", env.cloudinaryKey], ["CLOUDINARY_API_SECRET", env.cloudinarySecret]])
      if (!value || isPlaceholder(value)) throw new Error(`Set ${label} in production; resource uploads require Cloudinary.`);
    if (process.env.VERCEL === '1' && (!env.cronSecret || env.cronSecret.length < 16 || isPlaceholder(env.cronSecret)))
      throw new Error("Set CRON_SECRET to a random value of at least 16 characters in production.");
  }
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

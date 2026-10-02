const test = require('node:test');
const assert = require('node:assert/strict');
const { env, validateEnv } = require('./env');

test('production validates deployment origins, strong secrets, cookie mode, and provider settings', () => {
  const originalEnv = { ...env };
  const keys = ['MONGODB_URI','CLIENT_ORIGIN','CLIENT_ORIGINS','COOKIE_SECURE','COOKIE_SAME_SITE','JWT_SECRET','JWT_REFRESH_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_CALLBACK_URL','EMAIL_HOST','EMAIL_PORT','EMAIL_USER','EMAIL_PASSWORD','EMAIL_FROM','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','CRON_SECRET','VERCEL'];
  const originalProcess = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    env.nodeEnv = 'production';
    env.jwtSecret = 'a'.repeat(48);
    env.jwtRefreshSecret = 'b'.repeat(48);
    env.cookieSecure = true;
    process.env.CLIENT_ORIGIN = 'https://client.test';
    delete process.env.CLIENT_ORIGINS;
    env.clientOrigin = process.env.CLIENT_ORIGIN;
    env.clientOrigins = [process.env.CLIENT_ORIGIN];
    process.env.COOKIE_SECURE = 'true';
    process.env.COOKIE_SAME_SITE = 'none';
    delete process.env.MONGODB_URI;
    assert.throws(validateEnv, /MONGODB_URI/);

    process.env.MONGODB_URI = 'mongodb://database.test/jinfo';
    process.env.COOKIE_SECURE = 'false';
    assert.throws(validateEnv, /COOKIE_SECURE=true/);

    process.env.COOKIE_SECURE = 'true';
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'https://api.test/api/auth/google/callback';
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'user@gmail.com';
    process.env.EMAIL_PASSWORD = 'app-password';
    process.env.EMAIL_FROM = 'SetBGet <user@gmail.com>';
    process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'cloud-secret';
    process.env.CRON_SECRET = 'c'.repeat(32);
    env.mongoUri = process.env.MONGODB_URI;
    env.clientOrigin = process.env.CLIENT_ORIGIN;
    env.clientOrigins = [process.env.CLIENT_ORIGIN];
    env.googleClientId = process.env.GOOGLE_CLIENT_ID;
    env.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    env.googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL;
    env.emailHost = process.env.EMAIL_HOST;
    env.emailPort = Number(process.env.EMAIL_PORT);
    env.emailUser = process.env.EMAIL_USER;
    env.emailPassword = process.env.EMAIL_PASSWORD;
    env.emailFrom = process.env.EMAIL_FROM;
    env.cloudinaryName = process.env.CLOUDINARY_CLOUD_NAME;
    env.cloudinaryKey = process.env.CLOUDINARY_API_KEY;
    env.cloudinarySecret = process.env.CLOUDINARY_API_SECRET;
    env.cronSecret = process.env.CRON_SECRET;
    assert.doesNotThrow(validateEnv);

    delete process.env.VERCEL;
    env.cronSecret = '';
    assert.doesNotThrow(validateEnv, 'Render production does not use the Vercel Cron secret');
    process.env.VERCEL = '1';
    assert.throws(validateEnv, /CRON_SECRET/);
    env.cronSecret = process.env.CRON_SECRET;

    env.jwtRefreshSecret = env.jwtSecret;
    assert.throws(validateEnv, /distinct/);
    env.jwtRefreshSecret = 'b'.repeat(48);
    env.jwtSecret = 'YOUR_RANDOM_SECRET_THAT_IS_LONG_ENOUGH';
    assert.throws(validateEnv, /placeholder values/);
    env.jwtSecret = 'a'.repeat(48);
    process.env.CLIENT_ORIGIN = 'http://client.example';
    env.clientOrigin = process.env.CLIENT_ORIGIN;
    env.clientOrigins = [process.env.CLIENT_ORIGIN];
    assert.throws(validateEnv, /HTTPS origin/);
  } finally {
    Object.assign(env, originalEnv);
    for (const key of keys) {
      if (originalProcess[key] === undefined) delete process.env[key];
      else process.env[key] = originalProcess[key];
    }
  }
});

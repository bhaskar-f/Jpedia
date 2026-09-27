const test = require('node:test');
const assert = require('node:assert/strict');
const { env, validateEnv } = require('./env');

test('production requires an explicit database URI and Secure cookies', () => {
  const original = {
    nodeEnv: env.nodeEnv,
    jwtSecret: env.jwtSecret,
    jwtRefreshSecret: env.jwtRefreshSecret,
    cookieSecure: env.cookieSecure,
    mongoUriProcess: process.env.MONGODB_URI,
    clientOriginProcess: process.env.CLIENT_ORIGIN,
  };
  try {
    env.nodeEnv = 'production';
    env.jwtSecret = 'a'.repeat(48);
    env.jwtRefreshSecret = 'b'.repeat(48);
    env.cookieSecure = true;
    process.env.CLIENT_ORIGIN = 'https://client.example';
    delete process.env.MONGODB_URI;
    assert.throws(validateEnv, /MONGODB_URI explicitly/);

    process.env.MONGODB_URI = 'mongodb://database.example/jinfo';
    env.cookieSecure = false;
    assert.throws(validateEnv, /COOKIE_SECURE=true/);

    env.cookieSecure = true;
    assert.doesNotThrow(validateEnv);
  } finally {
    env.nodeEnv = original.nodeEnv;
    env.jwtSecret = original.jwtSecret;
    env.jwtRefreshSecret = original.jwtRefreshSecret;
    env.cookieSecure = original.cookieSecure;
    if (original.mongoUriProcess === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = original.mongoUriProcess;
    if (original.clientOriginProcess === undefined) delete process.env.CLIENT_ORIGIN;
    else process.env.CLIENT_ORIGIN = original.clientOriginProcess;
  }
});

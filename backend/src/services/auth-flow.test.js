const test = require('node:test');
const assert = require('node:assert/strict');
const authRoutes = require('../routes/auth.routes');
const { randomToken, hashToken } = require('../utils/tokens');
const { env } = require('../config/env');
const { setAccessCookie, setRefreshCookie } = require('../middleware/auth.middleware');

test('email authentication and recovery routes are registered', () => {
  const routes = authRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));

  for (const [path, method] of [
    ['/register', 'post'], ['/login', 'post'], ['/logout', 'post'],
    ['/refresh', 'post'], ['/verify-email', 'post'],
    ['/resend-verification', 'post'], ['/forgot-password', 'post'],
    ['/reset-password', 'post'], ['/google', 'get'], ['/google/callback', 'get'],
  ]) {
    assert.ok(routes.some((route) => route.path === path && route.methods[method]), `${method.toUpperCase()} ${path}`);
  }
});

test('verification and reset tokens are high entropy and stored as one-way hashes', () => {
  const token = randomToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(hashToken(token), token);
  assert.equal(hashToken(token), hashToken(token));
});

test('phone sign-in endpoints report Coming Soon in production without touching the SMS provider', () => {
  const oldEnvironment = env.nodeEnv;
  env.nodeEnv = 'production';
  try {
    for (const path of ['/login/phone', '/send-otp', '/verify-otp', '/set-phone-password']) {
      const route = authRoutes.stack.find(layer => layer.route?.path === path)?.route;
      const gate = route?.stack.find(layer => layer.handle.name === 'phoneAuthComingSoon')?.handle;
      assert.equal(typeof gate, 'function', `${path} has a production gate`);
      let calledNext = false;
      const response = {
        statusCode: 200,
        payload: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return this; },
      };
      gate({}, response, () => { calledNext = true; });
      assert.equal(calledNext, false);
      assert.equal(response.statusCode, 503);
      assert.equal(response.payload.error.code, 'PHONE_SIGN_IN_COMING_SOON');
    }
  } finally {
    env.nodeEnv = oldEnvironment;
  }
});

test('authentication cookies remain HTTP-only with correct paths and secure mode', () => {
  const oldSecure = env.cookieSecure;
  try {
    for (const secure of [false, true]) {
      env.cookieSecure = secure;
      const written = [];
      const response = { cookie: (name, value, options) => written.push({ name, value, options }) };
      setAccessCookie(response, 'access-token-test');
      setRefreshCookie(response, 'refresh-token-test');
      assert.deepEqual(written.map(cookie => cookie.name), ['jinfo_access', 'jinfo_refresh']);
      for (const cookie of written) {
        assert.equal(cookie.options.httpOnly, true);
        assert.equal(cookie.options.secure, secure);
        assert.equal(cookie.options.sameSite, 'lax');
      }
      assert.equal(written[0].options.path, '/');
      assert.equal(written[1].options.path, '/api/auth');
    }
  } finally {
    env.cookieSecure = oldSecure;
  }
});

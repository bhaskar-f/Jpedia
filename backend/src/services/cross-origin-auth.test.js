const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const passport = require('passport');
const { env } = require('../config/env');

const frontendOrigin = 'https://setbget-frontend.example';
env.clientOrigins = [frontendOrigin];
env.cookieSecure = true;
env.cookieSameSite = 'none';

const app = require('../app');
const auth = require('./auth.service');
const { User, NotificationPreference } = require('../models');

function cookiePair(headers, name) {
  const value = headers.find(header => header.startsWith(`${name}=`));
  assert.ok(value, `${name} cookie is present`);
  return value.split(';', 1)[0];
}

function assertProductionCookie(cookie, { path, maxAge }) {
  assert.match(cookie, /;\s*HttpOnly/i);
  assert.match(cookie, /;\s*Secure/i);
  assert.match(cookie, /;\s*SameSite=None/i);
  assert.match(cookie, new RegExp(`;\\s*Path=${path.replaceAll('/', '\\/')}(?:;|$)`, 'i'));
  assert.match(cookie, new RegExp(`;\\s*Max-Age=${maxAge}(?:;|$)`, 'i'));
  assert.doesNotMatch(cookie, /;\s*Domain=/i);
}

test('credentialed cross-origin login, authenticated request, refresh, preflight, and logout work together', async () => {
  const saved = {
    cookieSecure: env.cookieSecure,
    cookieSameSite: env.cookieSameSite,
    accessTtl: env.accessTtl,
    accessTtlMs: env.accessTtlMs,
    refreshDays: env.refreshDays,
    jwtSecret: env.jwtSecret,
    jwtRefreshSecret: env.jwtRefreshSecret,
    clientOrigin: env.clientOrigin,
    googleClientId: env.googleClientId,
    googleClientSecret: env.googleClientSecret,
    googleCallbackUrl: env.googleCallbackUrl,
    authenticate: auth.authenticate,
    issueSession: auth.issueSession,
    rotate: auth.rotate,
    logout: auth.logout,
    authenticateGoogle: auth.authenticateGoogle,
    findById: User.findById,
    notificationFindOneAndUpdate: NotificationPreference.findOneAndUpdate,
    connectionDb: mongoose.connection.db,
    passportAuthenticate: passport.authenticate,
  };
  const user = {
    id: 'cross-origin-user',
    _id: 'cross-origin-user',
    name: 'SetBGet Test User',
    email: 'cross-origin@example.test',
    role: 'USER',
    isActive: true,
    authTokenVersion: 0,
    toObject() {
      return {
        _id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        preferences: {},
      };
    },
  };
  const rateRecords = new Map();
  const rateCollection = {
    async createIndex() {},
    async updateOne(filter, update) {
      const record = rateRecords.get(filter._id);
      if (!record || record.expiresAt <= filter.expiresAt.$gt) return { matchedCount: 0 };
      record.hits += update.$inc?.hits || 0;
      return { matchedCount: 1 };
    },
    async findOne({ _id }) { return rateRecords.get(_id); },
    async findOneAndUpdate({ _id }, update) {
      const record = { _id, ...update.$set };
      rateRecords.set(_id, record);
      return { value: record };
    },
    async deleteOne({ _id }) { rateRecords.delete(_id); },
  };
  let tokenNumber = 0;
  let server;

  try {
    env.cookieSecure = true;
    env.cookieSameSite = 'none';
    env.accessTtl = '15m';
    env.accessTtlMs = 15 * 60 * 1000;
    env.refreshDays = 30;
    env.jwtSecret = 'cross-origin-access-test-secret';
    env.jwtRefreshSecret = 'cross-origin-refresh-test-secret';
    env.clientOrigin = frontendOrigin;
    env.googleClientId = 'test-google-client';
    env.googleClientSecret = 'test-google-secret';
    env.googleCallbackUrl = 'https://setbget-api.example/api/auth/google/callback';

    auth.authenticate = async () => user;
    auth.issueSession = async account => ({
      accessToken: jwt.sign(
        { sub: account.id, role: account.role, ver: account.authTokenVersion },
        env.jwtSecret,
        { expiresIn: env.accessTtl, issuer: 'j-info' },
      ),
      refreshToken: jwt.sign(
        { sub: account.id, jti: `test-${++tokenNumber}` },
        env.jwtRefreshSecret,
        { expiresIn: `${env.refreshDays}d`, issuer: 'j-info' },
      ),
    });
    auth.rotate = async () => ({ user, tokens: await auth.issueSession(user) });
    auth.logout = async () => {};
    auth.authenticateGoogle = async () => user;
    User.findById = () => ({ select: async () => user });
    NotificationPreference.findOneAndUpdate = async () => ({});
    passport.authenticate = (provider, options, callback) => {
      assert.equal(provider, 'google');
      if (callback) {
        return (req, res, next) => callback(null, {
          id: 'test-google-profile',
          displayName: user.name,
          emails: [{ value: user.email, verified: true }],
        });
      }
      return (req, res) => res.redirect('https://accounts.google.com/mock-consent');
    };
    mongoose.connection.db = { collection: () => rateCollection };

    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const apiOrigin = `http://127.0.0.1:${server.address().port}`;
    const preflight = await fetch(`${apiOrigin}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: frontendOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), frontendOrigin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
    assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);

    const login = await fetch(`${apiOrigin}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cross-origin@example.test', password: 'not-a-real-password' }),
    });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get('access-control-allow-origin'), frontendOrigin);
    assert.equal(login.headers.get('access-control-allow-credentials'), 'true');
    const loginCookies = login.headers.getSetCookie();
    assertProductionCookie(loginCookies.find(cookie => cookie.startsWith('jinfo_access=')), {
      path: '/', maxAge: 900,
    });
    assertProductionCookie(loginCookies.find(cookie => cookie.startsWith('jinfo_refresh=')), {
      path: '/api/auth', maxAge: 30 * 24 * 60 * 60,
    });

    const authenticated = await fetch(`${apiOrigin}/api/users/me`, {
      headers: {
        Origin: frontendOrigin,
        Cookie: cookiePair(loginCookies, 'jinfo_access'),
      },
    });
    assert.equal(authenticated.status, 200);
    assert.equal(authenticated.headers.get('access-control-allow-origin'), frontendOrigin);
    assert.equal((await authenticated.json()).data.user.email, user.email);

    const refreshed = await fetch(`${apiOrigin}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: frontendOrigin,
        Cookie: cookiePair(loginCookies, 'jinfo_refresh'),
      },
    });
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.headers.get('access-control-allow-credentials'), 'true');
    const refreshedCookies = refreshed.headers.getSetCookie();
    assertProductionCookie(refreshedCookies.find(cookie => cookie.startsWith('jinfo_access=')), {
      path: '/', maxAge: 900,
    });
    assertProductionCookie(refreshedCookies.find(cookie => cookie.startsWith('jinfo_refresh=')), {
      path: '/api/auth', maxAge: 30 * 24 * 60 * 60,
    });

    const logout = await fetch(`${apiOrigin}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: frontendOrigin,
        Cookie: cookiePair(refreshedCookies, 'jinfo_access'),
      },
    });
    assert.equal(logout.status, 200);
    assert.deepEqual((await logout.json()).data, { loggedOut: true });
    assert.equal(logout.headers.get('access-control-allow-credentials'), 'true');
    const clearedCookies = logout.headers.getSetCookie();
    assert.equal(clearedCookies.length, 2);
    for (const cookie of clearedCookies) {
      assert.match(cookie, /;\s*HttpOnly/i);
      assert.match(cookie, /;\s*Secure/i);
      assert.match(cookie, /;\s*SameSite=None/i);
      assert.match(cookie, /;\s*Expires=Thu, 01 Jan 1970/i);
    }
    assert.ok(clearedCookies.some(cookie => /;\s*Path=\//i.test(cookie)));
    assert.ok(clearedCookies.some(cookie => /;\s*Path=\/api\/auth/i.test(cookie)));

    const oauthStart = await fetch(`${apiOrigin}/api/auth/google`, {
      headers: { Origin: frontendOrigin },
      redirect: 'manual',
    });
    assert.equal(oauthStart.status, 302);
    assert.equal(oauthStart.headers.get('location'), 'https://accounts.google.com/mock-consent');
    const stateCookie = oauthStart.headers.getSetCookie().find(cookie => cookie.startsWith('jinfo_oauth_state='));
    assert.ok(stateCookie);
    assert.match(stateCookie, /;\s*HttpOnly/i);
    assert.match(stateCookie, /;\s*Secure/i);
    assert.match(stateCookie, /;\s*SameSite=None/i);
    assert.match(stateCookie, /;\s*Path=\/api\/auth\/google/i);
    assert.match(stateCookie, /;\s*Max-Age=600/i);

    const statePair = cookiePair([stateCookie], 'jinfo_oauth_state');
    const state = decodeURIComponent(statePair.slice('jinfo_oauth_state='.length));
    const oauthCallback = await fetch(`${apiOrigin}/api/auth/google/callback?state=${encodeURIComponent(state)}`, {
      headers: { Cookie: statePair },
      redirect: 'manual',
    });
    assert.equal(oauthCallback.status, 302);
    assert.equal(oauthCallback.headers.get('location'), `${frontendOrigin}/?auth=success`);
    const callbackCookies = oauthCallback.headers.getSetCookie();
    const clearedState = callbackCookies.find(cookie => cookie.startsWith('jinfo_oauth_state='));
    assert.match(clearedState, /;\s*Expires=Thu, 01 Jan 1970/i);
    assert.ok(callbackCookies.some(cookie => cookie.startsWith('jinfo_access=')));
    assert.ok(callbackCookies.some(cookie => cookie.startsWith('jinfo_refresh=')));

    const denied = await fetch(`${apiOrigin}/api/health`, {
      headers: { Origin: 'https://unlisted-frontend.example' },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    auth.authenticate = saved.authenticate;
    auth.issueSession = saved.issueSession;
    auth.rotate = saved.rotate;
    auth.logout = saved.logout;
    auth.authenticateGoogle = saved.authenticateGoogle;
    User.findById = saved.findById;
    NotificationPreference.findOneAndUpdate = saved.notificationFindOneAndUpdate;
    mongoose.connection.db = saved.connectionDb;
    passport.authenticate = saved.passportAuthenticate;
    env.cookieSecure = saved.cookieSecure;
    env.cookieSameSite = saved.cookieSameSite;
    env.accessTtl = saved.accessTtl;
    env.accessTtlMs = saved.accessTtlMs;
    env.refreshDays = saved.refreshDays;
    env.jwtSecret = saved.jwtSecret;
    env.jwtRefreshSecret = saved.jwtRefreshSecret;
    env.clientOrigin = saved.clientOrigin;
    env.googleClientId = saved.googleClientId;
    env.googleClientSecret = saved.googleClientSecret;
    env.googleCallbackUrl = saved.googleCallbackUrl;
  }
});

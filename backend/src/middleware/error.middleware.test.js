const test = require('node:test');
const assert = require('node:assert/strict');
const { env } = require('../config/env');
const { notFound, errorHandler } = require('./error.middleware');

function responseMock() {
  return {
    headersSent: false,
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('404 responses do not echo request URLs or query tokens', () => {
  const req = { method: 'GET', originalUrl: '/missing?token=private-value', path: '/missing' };
  const res = responseMock();
  notFound(req, res, error => errorHandler(error, req, res, () => {}));
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.message, 'Route not found.');
  assert.doesNotMatch(JSON.stringify(res.body), /private-value/);
});

test('production 500 responses and logs omit raw error details', () => {
  const oldEnvironment = env.nodeEnv;
  const oldConsoleError = console.error;
  const log = [];
  env.nodeEnv = 'production';
  console.error = value => log.push(JSON.stringify(value));
  try {
    const req = { path: '/api/test', id: 'request-id' };
    const res = responseMock();
    errorHandler(Object.assign(new Error('private database password value'), { status: 500, details: { token: 'secret' } }), req, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error.message, 'An unexpected error occurred.');
    assert.equal('details' in res.body.error, false);
    assert.doesNotMatch(JSON.stringify(res.body) + log.join(' '), /private database password value|secret/);
  } finally {
    env.nodeEnv = oldEnvironment;
    console.error = oldConsoleError;
  }
});

test('production database validation and duplicate errors return safe messages', () => {
  const original = env.nodeEnv;
  env.nodeEnv = 'production';
  try {
    for (const error of [
      Object.assign(new Error('Cast to ObjectId failed for value secret-id'), { name: 'CastError' }),
      Object.assign(new Error('E11000 duplicate key mongodb://private'), { code: 11000 }),
    ]) {
      const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      errorHandler(error, { path: '/api/test', id: 'test' }, response, () => {});
      assert.doesNotMatch(response.body.error.message, /secret-id|mongodb/);
    }
  } finally {
    env.nodeEnv = original;
  }
});

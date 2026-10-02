const test = require('node:test');
const assert = require('node:assert/strict');
const { health } = require('./health.controller');

test('health response exposes only status and timestamp', () => {
  let response;
  const res = { status() { return this; }, json(body) { response = body; } };
  health({}, res);
  assert.equal(response.success, true);
  assert.deepEqual(Object.keys(response.data).sort(), ['status', 'timestamp']);
  assert.equal(response.data.status, 'ok');
  assert.equal(Number.isNaN(Date.parse(response.data.timestamp)), false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCorsOptions, isOriginAllowed } = require('./cors');

test('CORS allows only exact configured origins and non-browser requests', () => {
  const allowed = ['https://jpedia.example', 'http://localhost:5500'];
  assert.equal(isOriginAllowed('https://jpedia.example', allowed), true);
  assert.equal(isOriginAllowed('http://localhost:5500', allowed), true);
  assert.equal(isOriginAllowed('https://attacker.example', allowed), false);
  assert.equal(isOriginAllowed('https://jpedia.example.attacker.example', allowed), false);
  assert.equal(isOriginAllowed(undefined, allowed), true);
});

test('credentialed CORS never uses wildcard origins', () => {
  const options = createCorsOptions(['https://jpedia.example']);
  assert.equal(options.credentials, true);
  options.origin('https://jpedia.example', (error, result) => {
    assert.equal(error, null);
    assert.equal(result, true);
  });
  options.origin('https://attacker.example', error => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'CORS_ORIGIN_DENIED');
  });
});

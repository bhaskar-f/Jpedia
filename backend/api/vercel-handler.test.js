const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createVercelHandler } = require('../src/config/vercel-handler');

test('split Vercel projects have independent static and Express roots with protected production schedules', () => {
  const frontend = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'vercel.json'), 'utf8'));
  const backend = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.equal(frontend.outputDirectory, 'public');
  assert.ok(frontend.rewrites.every(rule => !rule.source.startsWith('/api')));
  assert.ok(frontend.rewrites.some(rule => rule.source === '/admin/:path*'));
  assert.ok(frontend.rewrites.some(rule => rule.source === '/jobs/:id'));
  assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'frontend', 'build.js')));
  assert.ok(fs.existsSync(path.join(__dirname, '[...path].js')));
  assert.deepEqual(backend.crons.map(job => job.path), [
    '/api/cron/recruitment', '/api/cron/application-reminders',
    '/api/cron/deadline-notifications', '/api/cron/expire-jobs',
  ]);
  assert.deepEqual(backend.crons.map(job => job.schedule), [
    '0 3 * * *', '41 2 * * *', '11 2 * * *', '17 1 * * *',
  ]);
  assert.ok(backend.crons.every(job => job.schedule.split(' ')[2] === '*'
    && job.schedule.split(' ')[4] === '*'
    && !job.schedule.includes('*/')));
});

test('Vercel handler initializes once and forwards requests to the shared Express app', async () => {
  let initializations = 0;
  let appCalls = 0;
  const handler = createVercelHandler({
    initialize: async () => { initializations++; },
    application: () => { appCalls++; },
  });
  await Promise.all([handler({}, {}), handler({}, {})]);
  assert.equal(initializations, 1);
  assert.equal(appCalls, 2);
});

test('Vercel handler returns safe JSON when initialization fails', async () => {
  const handler = createVercelHandler({ initialize: async () => { throw Object.assign(new Error('private detail'), { code: 'PRIVATE' }); }, application: () => assert.fail('app must not run') });
  const originalError = console.error;
  console.error = () => {};
  let statusCode;
  let responseBody;
  try {
    await handler({}, {
      headersSent: false,
      setHeader() {},
      set statusCode(value) { statusCode = value; },
      end(body) { responseBody = JSON.parse(body); },
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(statusCode, 503);
  assert.deepEqual(responseBody, { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service is temporarily unavailable.' } });
});

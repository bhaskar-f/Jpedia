const test = require('node:test');
const assert = require('node:assert/strict');
const { createCronAuth, createTaskHandler } = require('./cron.routes');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('cron endpoint refuses missing and invalid bearer credentials', () => {
  const auth = createCronAuth('test-secret-0123456789');
  for (const header of ['', 'Bearer wrong']) {
    const res = response();
    let passed = false;
    auth({ get: () => header }, res, () => { passed = true; });
    assert.equal(passed, false);
    assert.equal(res.statusCode, 401);
  }
});

test('cron endpoint fails closed when no secret is configured', () => {
  const res = response();
  createCronAuth('')({ get: () => 'Bearer anything' }, res, () => assert.fail('must not pass'));
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, 'CRON_NOT_CONFIGURED');
});

test('cron endpoint executes known tasks only after authentication', async () => {
  const calls = [];
  const auth = createCronAuth('test-secret-0123456789');
  const task = createTaskHandler(async name => { calls.push(name); return { skipped: false, result: 4 }; });
  const req = { get: () => 'Bearer test-secret-0123456789', params: { task: 'recruitment' } };
  const res = response();
  let passed = false;
  auth(req, res, () => { passed = true; });
  assert.equal(passed, true);
  await task(req, res, error => { if (error) throw error; });
  assert.deepEqual(res.body, { success: true, data: { task: 'recruitment', skipped: false, result: 4 } });
  assert.deepEqual(calls, ['recruitment']);
  let taskError;
  await task({ params: { task: 'not-a-task' } }, response(), error => { taskError = error; });
  assert.equal(taskError.code, 'CRON_TASK_NOT_FOUND');
  assert.deepEqual(calls, ['recruitment']);
});

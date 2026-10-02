const test = require('node:test');
const assert = require('node:assert/strict');
const { withTaskLock } = require('./automation');

test('scheduled task lock runs work once and releases its lease', async () => {
  const records = new Map();
  const locks = {
    async findOneAndUpdate(filter, update) {
      const existing = records.get(filter._id);
      if (existing && existing.leaseUntil > filter.$or[0].leaseUntil.$lte) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      const value = { _id: filter._id, ...update.$set };
      records.set(filter._id, value);
      return value;
    },
    async deleteOne(filter) {
      if (records.get(filter._id)?.token === filter.token) records.delete(filter._id);
    },
  };
  const connection = { db: { collection: () => locks } };
  let runs = 0;
  const result = await withTaskLock('recruitment', async () => ++runs, { connection });
  assert.deepEqual(result, { skipped: false, result: 1 });
  assert.equal(runs, 1);
  assert.equal(records.size, 0);
});

test('scheduled task lock skips an already active run', async () => {
  const locks = {
    async findOneAndUpdate() { throw Object.assign(new Error('duplicate'), { code: 11000 }); },
    async deleteOne() { assert.fail('must not release another invocation lock'); },
  };
  const result = await withTaskLock('recruitment', async () => assert.fail('must not run'), { connection: { db: { collection: () => locks } } });
  assert.deepEqual(result, { skipped: true, reason: 'already-running' });
});

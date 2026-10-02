const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoRateLimitStore } = require('./mongo-rate-limit.store');

function fakeCollection() {
  const rows = new Map();
  return {
    rows,
    async createIndex() {},
    async updateOne(filter, update) {
      const row = rows.get(filter._id);
      if (!row || (filter.expiresAt?.$gt && row.expiresAt <= filter.expiresAt.$gt)) return { matchedCount: 0 };
      row.hits += update.$inc.hits;
      return { matchedCount: 1 };
    },
    async findOne(query) { return rows.get(query._id) || null; },
    async findOneAndUpdate(filter, update) {
      const row = rows.get(filter._id);
      if (row && row.expiresAt > filter.$or[0].expiresAt.$lte) throw Object.assign(new Error('duplicate key'), { code: 11000 });
      const next = { _id: filter._id, ...update.$set };
      rows.set(filter._id, next);
      return next;
    },
    async deleteOne(query) { rows.delete(query._id); },
  };
}

test('Mongo rate-limit store shares increment counts and expires old windows', async () => {
  let current = new Date('2026-01-01T00:00:00Z');
  const collection = fakeCollection();
  const store = new MongoRateLimitStore('auth-test', { getCollection: () => collection, now: () => current });
  store.init({ windowMs: 60_000 });
  assert.deepEqual(await store.increment('client'), { totalHits: 1, resetTime: new Date('2026-01-01T00:01:00Z') });
  assert.equal((await store.increment('client')).totalHits, 2);
  current = new Date('2026-01-01T00:02:00Z');
  assert.equal((await store.increment('client')).totalHits, 1);
  await store.resetKey('client');
  assert.equal(collection.rows.size, 0);
});

test('named Mongo rate-limit stores have distinct express-rate-limit prefixes', () => {
  const authStore = new MongoRateLimitStore('auth');
  const apiStore = new MongoRateLimitStore('api');
  assert.equal(authStore.prefix, 'auth');
  assert.equal(apiStore.prefix, 'api');
  assert.notEqual(authStore.prefix, apiStore.prefix);
});

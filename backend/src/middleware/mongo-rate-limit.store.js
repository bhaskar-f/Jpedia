const mongoose = require('mongoose');

class MongoRateLimitStore {
  constructor(name, { getCollection = () => mongoose.connection.db.collection('rate_limits'), now = () => new Date() } = {}) {
    this.name = name;
    this.prefix = name;
    this.getCollection = getCollection;
    this.now = now;
    this.windowMs = 60_000;
    this.indexPromise = null;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async ensureIndex(collection) {
    if (!this.indexPromise) {
      this.indexPromise = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'rate_limit_expiry' })
        .catch(error => { this.indexPromise = null; throw error; });
    }
    await this.indexPromise;
  }

  id(key) { return `${this.name}:${key}`; }

  async increment(key) {
    const collection = this.getCollection();
    await this.ensureIndex(collection);
    const id = this.id(key);
    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.windowMs);
    const updated = await collection.updateOne({ _id: id, expiresAt: { $gt: now } }, { $inc: { hits: 1 } });
    let record;
    if (updated.matchedCount) {
      record = await collection.findOne({ _id: id });
    } else {
      try {
        const result = await collection.findOneAndUpdate(
          { _id: id, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
          { $set: { hits: 1, expiresAt } },
          { upsert: true, returnDocument: 'after' },
        );
        record = result?.value || result;
      } catch (error) {
        if (error.code !== 11000) throw error;
        await collection.updateOne({ _id: id }, { $inc: { hits: 1 } });
        record = await collection.findOne({ _id: id });
      }
    }
    return { totalHits: record?.hits || 1, resetTime: record?.expiresAt || expiresAt };
  }

  async decrement(key) {
    await this.getCollection().updateOne({ _id: this.id(key) }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await this.getCollection().deleteOne({ _id: this.id(key) });
  }
}

module.exports = { MongoRateLimitStore };

const mongoose = require('mongoose');
const sources = require('../services/source.service');
const reminders = require('../services/reminder.service');
const jobs = require('../services/job.service');
const crypto = require('crypto');

const TASKS = Object.freeze({
  recruitment: () => sources.fetchAll(),
  'application-reminders': () => reminders.deliverApplicationReminders(),
  'deadline-notifications': () => reminders.deliverDeadlineNotifications(),
  'expire-jobs': () => jobs.fetchExpired(),
});

async function withTaskLock(task, work, { connection = mongoose.connection, now = () => new Date(), leaseMs = 10 * 60 * 1000 } = {}) {
  if (!Object.hasOwn(TASKS, task)) throw new Error('Unknown scheduled task.');
  if (!connection.db) throw new Error('MongoDB is not connected.');
  const locks = connection.db.collection('automation_locks');
  const timestamp = now();
  const token = crypto.randomUUID();
  let lock;
  try {
    const result = await locks.findOneAndUpdate(
      { _id: task, $or: [{ leaseUntil: { $lte: timestamp } }, { leaseUntil: { $exists: false } }] },
      { $set: { leaseUntil: new Date(timestamp.getTime() + leaseMs), token } },
      { upsert: true, returnDocument: 'after' },
    );
    lock = result?.value || result;
  } catch (error) {
    if (error.code === 11000) return { skipped: true, reason: 'already-running' };
    throw error;
  }
  if (!lock || lock.token !== token) return { skipped: true, reason: 'already-running' };
  try {
    return { skipped: false, result: await work() };
  } finally {
    await locks.deleteOne({ _id: task, token }).catch(() => {});
  }
}

async function runTask(task) {
  const work = TASKS[task];
  if (!work) throw new Error('Unknown scheduled task.');
  return withTaskLock(task, work);
}

module.exports = { TASKS, withTaskLock, runTask };

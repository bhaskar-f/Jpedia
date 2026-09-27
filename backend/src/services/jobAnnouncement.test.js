const test = require('node:test');
const assert = require('node:assert/strict');
const { User, Application, Notification, NotificationPreference } = require('../models');
const { announcePublishedJob } = require('./jobAnnouncement.service');

test('published-job announcements use the shared matcher, respect preferences, explain unknowns, and dedupe by user/job/type', async () => {
  const originals = {
    userFind: User.find,
    applicationFind: Application.find,
    preferenceFindOne: NotificationPreference.findOne,
    notificationUpsert: Notification.findOneAndUpdate,
  };
  const profiles = [
    { _id: 'user-qualified', preferences: { education: { level: 'BACHELORS', degrees: ['BSc'], fields: ['Physics'] }, preferredBoards: ['SSC'] } },
    { _id: 'user-unknown', preferences: { preferredBoards: ['SSC'] } },
    { _id: 'user-disabled', preferences: { preferredBoards: ['SSC'] } },
  ];
  const preferences = new Map([['user-disabled', { jobMatches: false }]]);
  const writes = [];
  let selectedFields = '';
  let userFilter;
  User.find = filter => { userFilter = filter; return { select(fields) { selectedFields = fields; return this; }, lean() { return this; }, cursor() { return { async *[Symbol.asyncIterator]() { yield* profiles; } }; } }; };
  Application.find = () => ({ select() { return this; }, async lean() { return []; } });
  NotificationPreference.findOne = ({ user }) => ({ select() { return this; }, async lean() { return preferences.get(String(user)) || null; } });
  Notification.findOneAndUpdate = async (...args) => { writes.push(args); return {}; };

  try {
    const job = { _id: 'job-123', title: 'SSC Scientific Assistant', board: { name: 'SSC' }, qualification: 'BSc Physics', category: 'Science', location: 'All India', status: 'PUBLISHED' };
    await announcePublishedJob(job);
    await announcePublishedJob(job);
    assert.equal(userFilter.role, 'USER', 'job-match notices target User accounts only');
    assert.match(selectedFields, /preferences/);
    assert.doesNotMatch(selectedFields, /passwordHash|refreshTokenHash|email/);
    assert.equal(writes.length, 4, 'the opted-out profile receives no new job-match notice');
    const keys = writes.map(([filter]) => filter.dedupeKey);
    assert.deepEqual(keys, [
      'user-qualified:job-123:JOB_POTENTIAL_MATCH',
      'user-unknown:job-123:JOB_POTENTIAL_MATCH',
      'user-qualified:job-123:JOB_POTENTIAL_MATCH',
      'user-unknown:job-123:JOB_POTENTIAL_MATCH',
    ]);
    const unknownMessage = writes[1][1].$setOnInsert.message;
    assert.match(unknownMessage, /Potential match because/);
    assert.match(unknownMessage, /Eligibility could not be fully evaluated/);
    assert.doesNotMatch(unknownMessage, /you are eligible/i);
    assert.ok(Notification.schema.indexes().some(([keys, options]) => keys.dedupeKey === 1 && options.unique && options.sparse));
  } finally {
    User.find = originals.userFind;
    Application.find = originals.applicationFind;
    NotificationPreference.findOne = originals.preferenceFindOne;
    Notification.findOneAndUpdate = originals.notificationUpsert;
  }
});

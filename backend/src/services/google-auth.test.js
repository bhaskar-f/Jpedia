const test = require('node:test');
const assert = require('node:assert/strict');
const { User } = require('../models');
const { authenticateGoogle } = require('./auth.service');

const verifiedProfile = (id = 'google-subject') => ({ id, displayName: 'Google User', emails: [{ value: 'person@example.com', verified: true }], photos: [{ value: 'https://example.com/avatar.png' }] });

test('Google authentication creates a new verified USER account', async () => {
  const originals = { findOne: User.findOne, create: User.create };
  let created;
  User.findOne = async () => null;
  User.create = async values => (created = { role: 'USER', ...values, isActive: true });
  try {
    const user = await authenticateGoogle(verifiedProfile());
    assert.equal(user.role, 'USER');
    assert.equal(created.email, 'person@example.com');
    assert.equal(created.isEmailVerified, true);
    assert.equal(created.googleId, 'google-subject');
  } finally { User.findOne = originals.findOne; User.create = originals.create; }
});

test('Google authentication safely links a verified matching email without changing role or password', async () => {
  const originals = { findOne: User.findOne };
  const user = { email: 'person@example.com', role: 'AUTHOR', passwordHash: 'existing-hash', googleId: undefined, isEmailVerified: false, isActive: true, save: async () => {} };
  User.findOne = async query => query.googleId ? null : user;
  try {
    assert.equal(await authenticateGoogle(verifiedProfile()), user);
    assert.equal(user.role, 'AUTHOR');
    assert.equal(user.passwordHash, 'existing-hash');
    assert.equal(user.googleId, 'google-subject');
    assert.equal(user.isEmailVerified, true);
  } finally { User.findOne = originals.findOne; }
});

test('Google authentication rejects an email already linked to another Google identity', async () => {
  const originals = { findOne: User.findOne };
  User.findOne = async query => query.googleId ? null : ({ email: 'person@example.com', googleId: 'different-subject', isActive: true });
  try { await assert.rejects(authenticateGoogle(verifiedProfile()), error => error.code === 'GOOGLE_ACCOUNT_MISMATCH'); }
  finally { User.findOne = originals.findOne; }
});

test('Google authentication requires a verified email and does not link disabled accounts', async () => {
  const originals = { findOne: User.findOne };
  User.findOne = async () => ({ email: 'person@example.com', isActive: false });
  try {
    await assert.rejects(authenticateGoogle({ ...verifiedProfile(), emails: [{ value: 'person@example.com', verified: false }] }), error => error.code === 'GOOGLE_EMAIL_MISSING');
    await assert.rejects(authenticateGoogle(verifiedProfile()), error => error.code === 'ACCOUNT_DISABLED');
  } finally { User.findOne = originals.findOne; }
});

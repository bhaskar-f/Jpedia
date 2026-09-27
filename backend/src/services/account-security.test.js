const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const auth = require('./auth.service');
const users = require('../routes/user.routes');
const { requireAuth } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');
const { changePassword } = require('../validators/schemas');
const { AppError } = require('../utils/http');

test('authenticated password changes validate input, verify the old password, and invalidate sessions', async () => {
  const routeLayers = users.stack;
  assert.ok(routeLayers[0] && !routeLayers[0].route, 'the router-level authentication middleware must run before account routes');
  assert.ok(routeLayers.some(layer => layer.route?.path === '/me/password' && layer.route.methods.patch));
  assert.ok(routeLayers.some(layer => layer.route?.path === '/me/email' && layer.route.methods.patch));
  assert.ok(routeLayers.some(layer => layer.route?.path === '/me/notification-preferences' && layer.route.methods.get));
  assert.ok(routeLayers.some(layer => layer.route?.path === '/me/notification-preferences' && layer.route.methods.patch));
  assert.ok(routeLayers.some(layer => layer.route?.path === '/me' && layer.route.methods.delete));

  const unauthenticatedError = await new Promise(resolve => {
    requireAuth({ cookies: {}, get: () => undefined }, {}, error => resolve(error));
  });
  assert.equal(unauthenticatedError.status, 401);

  assert.equal(changePassword.safeParse({ currentPassword: 'old-password', newPassword: 'new-password-123', confirmPassword: 'new-password-123' }).success, true);
  assert.equal(changePassword.safeParse({ currentPassword: 'old-password', newPassword: 'new-password-123', confirmPassword: 'different-password' }).success, false);
  assert.equal(changePassword.safeParse({ currentPassword: 'x', newPassword: 'short', confirmPassword: 'short' }).success, false);

  const originalFindById = User.findById;
  const document = {
    _id: 'user-id', isActive: true, authTokenVersion: 4, refreshTokenHash: 'existing-refresh-hash',
    passwordHash: await bcrypt.hash('old-password-123', 4),
    async save() { this.saved = true; },
    toObject() { return { passwordHash: this.passwordHash, refreshTokenHash: this.refreshTokenHash, authTokenVersion: this.authTokenVersion, name: 'User' }; },
  };
  User.findById = () => ({ select: async () => document });
  try {
    await assert.rejects(auth.changePassword('user-id', 'wrong-password', 'new-password-123', 'new-password-123'), error => error.code === 'CURRENT_PASSWORD_INCORRECT');
    assert.equal(document.authTokenVersion, 4, 'a rejected attempt must not invalidate sessions');
    await assert.rejects(auth.changePassword('user-id', 'old-password-123', 'new-password-123', 'different-password'), error => error.code === 'PASSWORD_CONFIRMATION_MISMATCH');

    await auth.changePassword('user-id', 'old-password-123', 'new-password-123', 'new-password-123');
    assert.equal(document.saved, true);
    assert.equal(document.authTokenVersion, 5);
    assert.equal(document.refreshTokenHash, undefined);
    assert.equal(await bcrypt.compare('new-password-123', document.passwordHash), true);
    assert.equal(await bcrypt.compare('old-password-123', document.passwordHash), false);
    const safe = auth.safeUser(document);
    assert.equal('passwordHash' in safe, false);
    assert.equal('refreshTokenHash' in safe, false);
  } finally {
    User.findById = originalFindById;
  }
});

test('account deactivation keeps the existing soft-deactivation and personal-record cleanup behavior', async () => {
  const models = [require('../models').SavedJob, require('../models').Application, require('../models').CommunityMember, require('../models').Notification];
  const originals = models.map(model => model.deleteMany);
  const removed = [];
  models.forEach(model => { model.deleteMany = async filter => { removed.push(filter); }; });
  const user = { _id: 'own-user', id: 'own-user', email: 'person@example.test', phoneNumber: '+12025550123', isActive: true, authTokenVersion: 2, refreshTokenHash: 'refresh', async save() { this.saved = true; } };
  const cleared = [];
  const response = { clearCookie(name, options) { cleared.push({ name, options }); }, status() { return this; }, json(body) { this.body = body; return this; } };
  try {
    await userController.deleteMe({ user }, response);
    assert.equal(user.isActive, false);
    assert.equal(user.email, 'deleted-own-user@invalid.local');
    assert.equal(user.phoneNumber, undefined);
    assert.equal(user.authTokenVersion, 3);
    assert.equal(user.refreshTokenHash, undefined);
    assert.equal(user.saved, true);
    assert.equal(response.body.data.deleted, true);
    assert.deepEqual(removed, Array(4).fill({ user: 'own-user' }));
    assert.deepEqual(cleared.map(cookie => cookie.name), ['jinfo_access', 'jinfo_refresh']);
  } finally {
    models.forEach((model, index) => { model.deleteMany = originals[index]; });
  }
});

test('account email and notification settings reuse their protected existing controller flows', async () => {
  const models = require('../models');
  const originalFindOneAndUpdate = models.NotificationPreference.findOneAndUpdate;
  const originalRequestEmailChange = auth.requestEmailChange;
  const writes = [];
  const prefs = { website: false, email: true, sms: true, jobMatches: false, deadlineReminders: true, announcements: false };
  models.NotificationPreference.findOneAndUpdate = async (query, update, options) => { writes.push({ query, update, options }); return prefs; };
  try {
    const response = () => ({ status() { return this; }, json(body) { this.body = body; return this; } });
    const readResponse = response();
    await userController.preferences({ user: { _id: 'own-user' } }, readResponse);
    assert.equal(readResponse.body.data.sms, true, 'SMS remains supported by the backend preference model');
    assert.deepEqual(writes[0].query, { user: 'own-user' });

    const updateResponse = response();
    await userController.updatePreferences({ user: { _id: 'own-user' }, body: { website: false, email: true, sms: true, jobMatches: false, deadlineReminders: true, announcements: false } }, updateResponse);
    assert.equal(updateResponse.body.data.announcements, false);
    assert.deepEqual(writes[1].update.$set, { website: false, email: true, sms: true, jobMatches: false, deadlineReminders: true, announcements: false });
    await assert.rejects(userController.updatePreferences({ user: { _id: 'own-user' }, body: { sms: 'yes' } }, response()), error => error.code === 'VALIDATION_ERROR');

    auth.requestEmailChange = async (_user, email) => email === 'new@example.test';
    const emailResponse = response();
    await userController.changeEmail({ user: { _id: 'own-user' }, body: { email: 'new@example.test' } }, emailResponse);
    assert.equal(emailResponse.body.data.verificationEmailSent, true);

    auth.requestEmailChange = async () => { throw new AppError(409, 'EMAIL_IN_USE', 'That email address is already in use.'); };
    await assert.rejects(userController.changeEmail({ user: { _id: 'own-user' }, body: { email: 'claimed@example.test' } }, response()), error => error.code === 'EMAIL_CHANGE_UNAVAILABLE' && !error.message.includes('already in use'));
  } finally {
    models.NotificationPreference.findOneAndUpdate = originalFindOneAndUpdate;
    auth.requestEmailChange = originalRequestEmailChange;
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { prepareBootstrapConfig, reconcileBootstrapAccounts } = require('./bootstrapAccounts');

const plainHasher = {
  async hash(password) { return `$test-hash$${password}`; },
  async compare(password, hash) { return hash === `$test-hash$${password}`; },
};
const baseEnv = () => ({
  SUPER_ADMIN_EMAIL: 'root@jinfo.test', SUPER_ADMIN_PASSWORD: 'RootPass!2026', SUPER_ADMIN_NAME: 'Root Admin',
  ADMIN_EMAIL: 'ADMIN@jinfo.test', ADMIN_PASSWORD: 'AdminPass!2026', ADMIN_NAME: 'Dev Admin', ADMIN_MOBILE: '',
  AUTHOR_EMAIL: 'author@jinfo.local', AUTHOR_PASSWORD: 'AuthorPass!2026', AUTHOR_NAME: 'Dev Author', AUTHOR_MOBILE: '',
});
function memoryModels(initial = []) {
  let nextId = 1;
  const users = initial.map(value => ({ ...value, _id: value._id || `id-${nextId++}`, saves: 0, async save() { this.saves++; } }));
  const User = {
    findOne({ email }) { return { select: async selection => { assert.equal(selection, '+passwordHash'); return users.find(user => user.email === email) || null; } }; },
    async exists(query) { return users.some(user => user.phoneNumber === query.phoneNumber && (!query._id || user._id !== query._id.$ne)); },
    async create(value) { const user = { ...value, _id: `id-${nextId++}`, saves: 0, async save() { this.saves++; } }; users.push(user); return user; },
  };
  const NotificationPreference = { findOneAndUpdate: async () => ({}) };
  return { User, NotificationPreference, users };
}
const quiet = async fn => {
  const lines = [], original = console.info;
  console.info = line => lines.push(String(line));
  try { return { result: await fn(), lines }; } finally { console.info = original; }
};

test('1. creates all missing configured bootstrap accounts with bcrypt hashes and intended roles', async () => {
  const accounts = prepareBootstrapConfig(baseEnv(), 'development');
  const models = memoryModels();
  await reconcileBootstrapAccounts(accounts, models.User, models.NotificationPreference);
  assert.deepEqual(models.users.map(user => user.role), ['SUPER_ADMIN', 'ADMIN', 'AUTHOR']);
  for (const user of models.users) assert.match(user.passwordHash, /^\$2[ab]\$/);
  assert.ok(models.users.every(user => user.isEmailVerified));
});

test('2. second seed with the same configuration leaves accounts unchanged', async () => {
  const accounts = prepareBootstrapConfig(baseEnv(), 'development'), models = memoryModels();
  await reconcileBootstrapAccounts(accounts, models.User, models.NotificationPreference, plainHasher);
  const savedHashes = models.users.map(user => user.passwordHash);
  const { result, lines } = await quiet(() => reconcileBootstrapAccounts(accounts, models.User, models.NotificationPreference, plainHasher));
  assert.deepEqual(result.map(item => item.status), ['unchanged', 'unchanged', 'unchanged']);
  assert.deepEqual(models.users.map(user => user.passwordHash), savedHashes);
  assert.ok(lines.every(line => line.endsWith(': unchanged')));
});

for (const [label, prefix, role] of [['3. Author password rotation', 'AUTHOR', 'AUTHOR'], ['4. Admin password rotation', 'ADMIN', 'ADMIN'], ['5. Super Admin password rotation', 'SUPER_ADMIN', 'SUPER_ADMIN']]) {
  test(label, async () => {
    const env = baseEnv(), accounts = prepareBootstrapConfig(env, 'development'), selected = accounts.find(account => account.role === role);
    const models = memoryModels([{ _id: 'existing', email: selected.email, name: selected.name, role, passwordHash: '$test-hash$old-password', authTokenVersion: 4, refreshTokenHash: 'old-refresh', isEmailVerified: true }]);
    env[`${prefix}_PASSWORD`] = 'NewPass!2026';
    const changed = prepareBootstrapConfig(env, 'development').find(account => account.role === role);
    const { result, lines } = await quiet(() => reconcileBootstrapAccounts([changed], models.User, models.NotificationPreference, plainHasher));
    assert.equal(result[0].passwordChanged, true);
    assert.equal(models.users[0].passwordHash, '$test-hash$NewPass!2026');
    assert.equal(models.users[0].authTokenVersion, 5);
    assert.equal(models.users[0].refreshTokenHash, undefined);
    assert.ok(lines.every(line => !line.includes('NewPass!2026')));
  });
}

test('6. bcrypt rotation rejects the old password and accepts the new password', async () => {
  const env = baseEnv(), chosen = prepareBootstrapConfig(env, 'development').find(account => account.role === 'ADMIN');
  const oldHash = await bcrypt.hash(chosen.password, 4), models = memoryModels([{ email: chosen.email, name: chosen.name, role: 'ADMIN', passwordHash: oldHash, isEmailVerified: true }]);
  env.ADMIN_PASSWORD = 'ChangedPass!2026';
  const next = prepareBootstrapConfig(env, 'development').find(account => account.role === 'ADMIN');
  await reconcileBootstrapAccounts([next], models.User, models.NotificationPreference);
  assert.equal(await bcrypt.compare(chosen.password, models.users[0].passwordHash), false);
  assert.equal(await bcrypt.compare(next.password, models.users[0].passwordHash), true);
});

test('7. password changes invalidate access versions and stored refresh tokens exactly once', async () => {
  const env = baseEnv(), old = prepareBootstrapConfig(env, 'development').find(account => account.role === 'ADMIN');
  const models = memoryModels([{ email: old.email, name: old.name, role: old.role, passwordHash: '$test-hash$old', authTokenVersion: 8, refreshTokenHash: 'refresh' }]);
  env.ADMIN_PASSWORD = 'DifferentPass!2026';
  let next = prepareBootstrapConfig(env, 'development').find(account => account.role === 'ADMIN');
  await reconcileBootstrapAccounts([next], models.User, models.NotificationPreference, plainHasher);
  assert.equal(models.users[0].authTokenVersion, 9);
  assert.equal(models.users[0].refreshTokenHash, undefined);
  await reconcileBootstrapAccounts([next], models.User, models.NotificationPreference, plainHasher);
  assert.equal(models.users[0].authTokenVersion, 9);
});

test('8. explicitly changing only a bootstrap name preserves unrelated profile fields and password', async () => {
  const env = baseEnv(), account = prepareBootstrapConfig(env, 'development').find(item => item.role === 'AUTHOR');
  const models = memoryModels([{ email: account.email, role: account.role, name: account.name, passwordHash: '$test-hash$AuthorPass!2026', location: 'Kolkata', education: 'History', authTokenVersion: 2 }]);
  env.AUTHOR_NAME = 'Updated Author';
  const next = prepareBootstrapConfig(env, 'development').find(item => item.role === 'AUTHOR');
  await reconcileBootstrapAccounts([next], models.User, models.NotificationPreference, plainHasher);
  assert.equal(models.users[0].name, 'Updated Author');
  assert.equal(models.users[0].location, 'Kolkata');
  assert.equal(models.users[0].education, 'History');
  assert.equal(models.users[0].passwordHash, '$test-hash$AuthorPass!2026');
  assert.equal(models.users[0].authTokenVersion, 2);
});

test('9. unconfigured accounts are untouched', async () => {
  const models = memoryModels([{ email: 'ordinary@example.com', role: 'USER', passwordHash: 'unchanged' }]);
  const results = await reconcileBootstrapAccounts([], models.User, models.NotificationPreference, plainHasher);
  assert.deepEqual(results, []);
  assert.equal(models.users[0].passwordHash, 'unchanged');
  assert.equal(models.users[0].saves, 0);
});

test('10. duplicate normalized bootstrap emails fail during preflight', () => {
  const env = baseEnv(); env.ADMIN_EMAIL = ' ROOT@JINFO.TEST ';
  assert.throws(() => prepareBootstrapConfig(env, 'development'), /both Super Admin and Admin/);
});

test('11. seed logs never contain configured passwords', async () => {
  const accounts = prepareBootstrapConfig(baseEnv(), 'development'), models = memoryModels();
  const { lines } = await quiet(() => reconcileBootstrapAccounts(accounts, models.User, models.NotificationPreference, plainHasher));
  const passwords = accounts.map(account => account.password);
  assert.ok(passwords.every(password => lines.every(line => !line.includes(password))));
});

test('12. a configured identity gets its intended role while unrelated users retain their roles', async () => {
  const env = baseEnv(), admin = prepareBootstrapConfig(env, 'development').find(account => account.role === 'ADMIN');
  const models = memoryModels([
    { email: admin.email, role: 'USER', name: 'Existing profile', passwordHash: '$test-hash$AdminPass!2026', location: 'Delhi' },
    { email: 'unconfigured@example.com', role: 'USER', name: 'Keep', passwordHash: 'not-touched' },
  ]);
  await reconcileBootstrapAccounts([admin], models.User, models.NotificationPreference, plainHasher);
  assert.equal(models.users[0].role, 'ADMIN');
  assert.equal(models.users[0].location, 'Delhi');
  assert.equal(models.users[1].role, 'USER');
  assert.equal(models.users[1].passwordHash, 'not-touched');
});

test('13. invalid password/email and role overlap fail before reconciliation', () => {
  const env = baseEnv(); env.AUTHOR_EMAIL = 'not-an-email';
  assert.throws(() => prepareBootstrapConfig(env, 'development'), /valid AUTHOR_EMAIL/);
  const shortPassword = baseEnv(); shortPassword.ADMIN_PASSWORD = 'short';
  assert.throws(() => prepareBootstrapConfig(shortPassword, 'development'), /12 to 128/);
});

test('14. configured bootstrap phone/name fields update only when configured', async () => {
  const env = baseEnv(), old = prepareBootstrapConfig(env, 'development').find(account => account.role === 'ADMIN');
  const models = memoryModels([{ email: old.email, role: 'ADMIN', name: old.name, phoneNumber: '+14155552671', passwordHash: '$test-hash$AdminPass!2026' }]);
  env.ADMIN_MOBILE = '+14155552672'; env.ADMIN_NAME = 'Named Admin';
  const next = prepareBootstrapConfig(env, 'development').find(account => account.role === 'ADMIN');
  await reconcileBootstrapAccounts([next], models.User, models.NotificationPreference, plainHasher);
  assert.equal(models.users[0].phoneNumber, '+14155552672');
  assert.equal(models.users[0].name, 'Named Admin');
});

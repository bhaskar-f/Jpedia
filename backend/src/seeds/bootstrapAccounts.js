const bcrypt = require('bcryptjs');

// Only identities explicitly configured by *_EMAIL are reconciled. Updating a configured *_PASSWORD
// and rerunning the seed resets that bootstrap account's password; ordinary users are never touched.

const definitions = [
  { prefix: 'SUPER_ADMIN', role: 'SUPER_ADMIN', label: 'Super Admin', defaultName: 'System Administrator' },
  { prefix: 'ADMIN', role: 'ADMIN', label: 'Admin', defaultName: 'J-Info Development Admin', phoneKey: 'ADMIN_MOBILE' },
  { prefix: 'AUTHOR', role: 'AUTHOR', label: 'Author', defaultName: 'J-Info Development Author', phoneKey: 'AUTHOR_MOBILE', developmentEmailOnly: true },
];
const emailPattern = /^\S+@\S+\.\S+$/;
const phonePattern = /^\+[1-9]\d{7,14}$/;

function prepareBootstrapConfig(environment, nodeEnv) {
  const prepared = [];
  for (const definition of definitions) {
    const { prefix, phoneKey } = definition;
    const emailKey = `${prefix}_EMAIL`, passwordKey = `${prefix}_PASSWORD`, nameKey = `${prefix}_NAME`;
    const configured = [emailKey, passwordKey, nameKey, phoneKey].some(key => key && environment[key] !== undefined && String(environment[key]).trim() !== '');
    if (!configured) continue;
    if (!['development', 'test'].includes(nodeEnv)) throw new Error(`${definition.label} bootstrap accounts are only allowed when NODE_ENV is development or test.`);
    const email = String(environment[emailKey] || '').trim().toLowerCase();
    const password = String(environment[passwordKey] || '');
    const hasName = environment[nameKey] !== undefined && String(environment[nameKey]).trim() !== '';
    const name = hasName ? String(environment[nameKey]).trim() : definition.defaultName;
    const hasPhone = Boolean(phoneKey && environment[phoneKey] !== undefined && String(environment[phoneKey]).trim() !== '');
    const phoneNumber = hasPhone ? String(environment[phoneKey] || '').trim() : undefined;
    if (!email || !emailPattern.test(email)) throw new Error(`Use a valid ${emailKey} for the configured ${definition.label} account.`);
    if (password.length < 12 || password.length > 128) throw new Error(`${passwordKey} must contain 12 to 128 characters.`);
    if (environment[nameKey] !== undefined && !hasName) throw new Error(`${nameKey} must contain a name when configured.`);
    if (hasPhone && phoneNumber && !phonePattern.test(phoneNumber)) throw new Error(`${phoneKey} must use E.164 format or be blank.`);
    if (definition.developmentEmailOnly && !/\.(local|test)$/i.test(email)) throw new Error('AUTHOR_EMAIL must be a valid development address ending in .local or .test.');
    prepared.push({ ...definition, email, password, name, hasName, hasPhone, phoneNumber });
  }
  const emailOwners = new Map();
  for (const account of prepared) {
    const previous = emailOwners.get(account.email);
    if (previous) throw new Error(`Bootstrap email is configured for both ${previous.label} and ${account.label}; use distinct emails.`);
    emailOwners.set(account.email, account);
  }
  return prepared;
}

async function reconcileBootstrapAccounts(accounts, User, NotificationPreference, passwordHasher = bcrypt) {
  const currentAccounts = await Promise.all(accounts.map(async config => User.findOne({ email: config.email }).select('+passwordHash')));
  for (let i = 0; i < accounts.length; i++) {
    const config = accounts[i], current = currentAccounts[i];
    if (!config.phoneNumber) continue;
    const query = { phoneNumber: config.phoneNumber };
    if (current) query._id = { $ne: current._id };
    if (await User.exists(query)) throw new Error(`${config.phoneKey} is already linked to another account.`);
  }
  const results = [];
  for (let index = 0; index < accounts.length; index++) {
    const config = accounts[index];
    const { email, password, role, label, name, hasName, hasPhone, phoneNumber } = config;
    let user = currentAccounts[index];
    if (!user) {
      user = await User.create({ name, email, phoneNumber: phoneNumber || undefined, passwordHash: await passwordHasher.hash(password, 12), role, isEmailVerified: true });
      await NotificationPreference.findOneAndUpdate({ user: user._id }, { $setOnInsert: { user: user._id } }, { upsert: true });
      console.info(`[seed] ${label}: created`);
      results.push({ label, status: 'created', passwordChanged: true, roleChanged: false });
      continue;
    }
    const passwordChanged = !await passwordHasher.compare(password, user.passwordHash || '');
    const roleChanged = user.role !== role;
    const changedFields = [];
    if (passwordChanged) { user.passwordHash = await passwordHasher.hash(password, 12); changedFields.push('password'); }
    if (roleChanged) { user.role = role; changedFields.push('role'); }
    if (hasName && user.name !== name) { user.name = name; changedFields.push('name'); }
    if (hasPhone && (user.phoneNumber || '') !== (phoneNumber || '')) { user.phoneNumber = phoneNumber || undefined; changedFields.push('phone'); }
    if (passwordChanged || roleChanged) {
      user.authTokenVersion = (user.authTokenVersion || 0) + 1;
      user.refreshTokenHash = undefined;
      changedFields.push('sessions');
    }
    if (changedFields.length) {
      await user.save();
      console.info(`[seed] ${label}: updated${passwordChanged ? ' (password updated)' : ''}`);
      results.push({ label, status: 'updated', passwordChanged, roleChanged, changedFields });
    } else {
      console.info(`[seed] ${label}: unchanged`);
      results.push({ label, status: 'unchanged', passwordChanged: false, roleChanged: false, changedFields: [] });
    }
    await NotificationPreference.findOneAndUpdate({ user: user._id }, { $setOnInsert: { user: user._id } }, { upsert: true });
  }
  return results;
}

module.exports = { prepareBootstrapConfig, reconcileBootstrapAccounts };
